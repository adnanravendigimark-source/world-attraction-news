import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getRoleById, updateRole, deleteRole } from "@/lib/roles";
import { logActivity } from "@/lib/activity";
import { dbErrorMessage } from "@/lib/db";
import { requireApiPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const denied = await requireApiPermission(session, "roles", "update");
  if (denied) return denied;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    const role = await updateRole(params.id, {
      name: typeof body.name === "string" ? body.name : undefined,
      description: typeof body.description === "string" ? body.description : undefined,
      permissions: body.permissions,
    });
    await logActivity(session, "role_updated", { type: "role", id: role.id, label: role.name });
    return NextResponse.json({ ok: true, role });
  } catch (err) {
    const message = err instanceof Error ? err.message : dbErrorMessage(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const denied = await requireApiPermission(session, "roles", "delete");
  if (denied) return denied;

  const before = await getRoleById(params.id).catch(() => undefined);
  try {
    await deleteRole(params.id);
    if (before) {
      await logActivity(session, "role_deleted", { type: "role", id: params.id, label: before.name });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    // deleteRole() throws a friendly, user-facing message when the role is
    // still assigned to one or more users (see lib/roles.ts) — surface it
    // as-is rather than a generic 500.
    const message = err instanceof Error ? err.message : dbErrorMessage(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
