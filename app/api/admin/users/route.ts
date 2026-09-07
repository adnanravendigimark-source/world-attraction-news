import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getUsers, createContributorByAdmin } from "@/lib/users";
import { dbErrorMessage } from "@/lib/db";
import { requireApiPermission, getEffectivePermissions } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  const denied = await requireApiPermission(session, "contributors", "read");
  if (denied) return denied;
  try {
    const users = await getUsers();
    return NextResponse.json({ users });
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getSession();
  const denied = await requireApiPermission(session, "contributors", "create");
  if (denied) return denied;
  try {
    const body = await req.json();
    if (!body.email || !body.displayName) {
      return NextResponse.json({ error: "Name and email are required." }, { status: 400 });
    }
    const requestedRole = body.role === "admin" ? "admin" : "contributor";
    // A restricted admin holding "contributors:create" is only meant to be
    // able to onboard contributors, not mint brand-new admin accounts (a
    // new admin gets role_id = NULL = unrestricted by default, so this
    // would otherwise be a straight path to full access). Creating another
    // admin here is only allowed for an unrestricted admin/owner.
    if (requestedRole === "admin") {
      const effective = await getEffectivePermissions(session);
      if (effective !== "full") {
        return NextResponse.json(
          { error: "Only an unrestricted admin can create new admin accounts." },
          { status: 403 }
        );
      }
    }
    const user = await createContributorByAdmin({
      email: body.email.trim(),
      displayName: body.displayName.trim(),
      password: body.password || undefined,
      bio: body.bio?.trim() || "",
      role: requestedRole,
      status: body.status === "pending" ? "pending" : "approved",
    });
    return NextResponse.json({ user }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || dbErrorMessage(err) }, { status: 400 });
  }
}
