import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { findUserById, setUserRoleId } from "@/lib/users";
import { getRoleById } from "@/lib/roles";
import { logActivity } from "@/lib/activity";
import { dbErrorMessage } from "@/lib/db";
import { requireApiPermission, getEffectivePermissions } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// Deliberately its OWN route, separate from PATCH /api/admin/users/[id] —
// assigning which RBAC role an admin has is a privilege-escalation-
// sensitive operation and must never ride along with the generic
// "edit contributor" endpoint (see lib/users.ts's setUserRoleId comment).
// Gated on the "roles" page's "update" permission, not "contributors" —
// holding permission to edit contributor profiles should never imply the
// ability to change what any admin account can access.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const denied = await requireApiPermission(session, "roles", "update");
  if (denied) return denied;

  // A user can never change their own role assignment, even with
  // roles:update — otherwise that permission alone would let someone grant
  // themselves unrestricted access by clearing their own role_id. Role
  // changes must always come from a different admin (or the owner).
  if (session.userId === params.id) {
    return NextResponse.json({ error: "You can't change your own role assignment." }, { status: 403 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const roleId: string | null = body.roleId === null || body.roleId === undefined ? null : String(body.roleId);

  const target = await findUserById(params.id).catch(() => undefined);
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });
  if (target.role !== "admin") {
    return NextResponse.json({ error: "Only admin accounts can be assigned an Admin Panel role." }, { status: 400 });
  }

  if (roleId) {
    const role = await getRoleById(roleId).catch(() => undefined);
    if (!role) return NextResponse.json({ error: "That role doesn't exist." }, { status: 400 });
  } else {
    // Setting roleId back to NULL grants the target account full,
    // unrestricted access — only an already-unrestricted admin/owner can
    // hand that out, so two restricted admins can't collude to promote
    // each other to unrestricted via this endpoint.
    const effective = await getEffectivePermissions(session);
    if (effective !== "full") {
      return NextResponse.json(
        { error: "Only an unrestricted admin can remove someone's role restriction." },
        { status: 403 }
      );
    }
  }

  try {
    const updated = await setUserRoleId(params.id, roleId);
    await logActivity(
      session,
      "user_role_assigned",
      { type: "user", id: target.id, label: target.email },
      { roleId }
    );
    return NextResponse.json({ ok: true, user: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : dbErrorMessage(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
