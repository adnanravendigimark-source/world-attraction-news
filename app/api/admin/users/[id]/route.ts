import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { updateUser, deleteUser, findUserById } from "@/lib/users";
import { logActivity } from "@/lib/activity";
import { dbErrorMessage } from "@/lib/db";

export const dynamic = "force-dynamic";

// Approve/reject/suspend/reactivate a registration, or promote/demote a
// role — from the Admin Panel's Users page. Contributors aren't tied to a
// single city, so approval doesn't require (or accept) a city assignment —
// they choose which city each article belongs to when they submit it.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const target = await findUserById(params.id).catch(() => undefined);
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });

  const nextRole = body.role === "admin" || body.role === "contributor" ? body.role : undefined;
  const nextStatus =
    body.status === "pending" ||
    body.status === "approved" ||
    body.status === "rejected" ||
    body.status === "suspended"
      ? body.status
      : undefined;

  // Server-side enforcement of the same rule the UI already hides behind
  // (UsersTable.tsx / UserDetailPanel.tsx don't render an Approve/Reject
  // button for an unverified pending account) — never trust the client
  // alone for a real business rule like this.
  if (nextStatus && nextStatus !== "pending" && target.status === "pending" && !target.emailVerified) {
    return NextResponse.json(
      { error: "This account hasn't verified its email yet, so it can't be approved or rejected." },
      { status: 400 }
    );
  }

  try {
    const updated = await updateUser(params.id, {
      role: nextRole,
      status: nextStatus,
      displayName: body.displayName !== undefined ? body.displayName : undefined,
      bio: body.bio !== undefined ? body.bio : undefined,
    });

    if (nextStatus && nextStatus !== target.status) {
      const actionByStatus: Record<string, string> = {
        approved: "user_approved",
        rejected: "user_rejected",
        suspended: "user_suspended",
        pending: "user_set_pending",
      };
      await logActivity(
        session,
        actionByStatus[nextStatus] || "user_status_changed",
        { type: "user", id: target.id, label: target.email },
        { from: target.status, to: nextStatus }
      );
    }
    if (nextRole && nextRole !== target.role) {
      await logActivity(
        session,
        nextRole === "admin" ? "user_promoted_admin" : "user_demoted_contributor",
        { type: "user", id: target.id, label: target.email },
        { from: target.role, to: nextRole }
      );
    }

    return NextResponse.json({ ok: true, user: updated });
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const target = await findUserById(params.id).catch(() => undefined);

  try {
    await deleteUser(params.id);
    if (target) {
      await logActivity(session, "user_deleted", { type: "user", id: params.id, label: target.email });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}
