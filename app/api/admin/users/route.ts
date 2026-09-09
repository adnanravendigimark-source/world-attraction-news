import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getContributors, createContributorByAdmin, setUserRoleId } from "@/lib/users";
import { getRoleById } from "@/lib/roles";
import { logActivity } from "@/lib/activity";
import { dbErrorMessage } from "@/lib/db";
import { requireApiPermission, getEffectivePermissions } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  const denied = await requireApiPermission(session, "contributors", "read");
  if (denied) return denied;
  try {
    const users = await getContributors();
    return NextResponse.json({ users });
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}

// Contributors are never created from the Admin Panel anymore — they only
// come from public signup or Google login (see lib/users.ts's
// registerContributor / findOrCreateGoogleUser). This endpoint's only
// remaining job is Admin -> Roles & Permissions' "Add User": creating a new
// *admin* account and, optionally, assigning it one of the roles an
// unrestricted admin has created.
export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const denied = await requireApiPermission(session, "roles", "create");
  if (denied) return denied;

  // A brand-new admin account always starts with role_id = NULL
  // (unrestricted) until a role is assigned — so minting one is only ever
  // allowed for an already-unrestricted admin/owner, regardless of which
  // page-level permissions their own role happens to grant.
  const effective = await getEffectivePermissions(session);
  if (effective !== "full") {
    return NextResponse.json(
      { error: "Only an unrestricted admin can create new admin accounts." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    if (!body.email || !body.displayName) {
      return NextResponse.json({ error: "Name and email are required." }, { status: 400 });
    }

    let role = null;
    if (body.roleId) {
      role = await getRoleById(body.roleId).catch(() => undefined);
      if (!role) return NextResponse.json({ error: "That role doesn't exist." }, { status: 400 });
    }

    let user = await createContributorByAdmin({
      email: body.email.trim(),
      displayName: body.displayName.trim(),
      password: body.password || undefined,
      role: "admin",
      status: "approved",
    });

    if (role) {
      user = await setUserRoleId(user.id, role.id);
    }

    await logActivity(session, "admin_user_created", { type: "user", id: user.id, label: user.email }, { roleId: role?.id || null });
    return NextResponse.json({ user }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || dbErrorMessage(err) }, { status: 400 });
  }
}
