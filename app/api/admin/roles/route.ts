import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getAllRoles, createRole, getRoleUserCounts, ADMIN_PAGES } from "@/lib/roles";
import { logActivity } from "@/lib/activity";
import { dbErrorMessage } from "@/lib/db";
import { requireApiPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// Backs Admin -> Roles & Permissions. Reading the role list is gated on
// "roles":"read" just like every other admin resource; ADMIN_PAGES is
// included in the GET response so the editor UI always renders the exact
// same page list requireApiPermission() enforces against (one source of
// truth — see lib/roles.ts).
export async function GET() {
  const session = await getSession();
  const denied = await requireApiPermission(session, "roles", "read");
  if (denied) return denied;
  try {
    const [roles, userCounts] = await Promise.all([getAllRoles(), getRoleUserCounts()]);
    return NextResponse.json({ roles, userCounts, pages: ADMIN_PAGES });
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const denied = await requireApiPermission(session, "roles", "create");
  if (denied) return denied;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!body || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "Role name is required." }, { status: 400 });
  }

  try {
    const role = await createRole({
      name: body.name,
      description: typeof body.description === "string" ? body.description : "",
      permissions: body.permissions || {},
    });
    await logActivity(session, "role_created", { type: "role", id: role.id, label: role.name });
    return NextResponse.json({ ok: true, role }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : dbErrorMessage(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
