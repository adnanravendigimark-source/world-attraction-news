import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { updateUser, deleteUser, findUserById } from "@/lib/users";
import { logActivity } from "@/lib/activity";
import { dbErrorMessage } from "@/lib/db";
import { notifyAccountApproved, notifyAccountRejected } from "@/lib/notifications";
import { getEffectivePermissions, hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// Approve/reject/suspend/reactivate/edit a user from the Admin Panel.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const effective = await getEffectivePermissions(session);
  const canUpdate = hasPermission(effective, "contributors", "update") || hasPermission(effective, "roles", "update");
  if (!canUpdate) {
    return NextResponse.json({ error: "You don't have permission to update users." }, { status: 403 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const target = await findUserById(params.id).catch(() => undefined);
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });

  if (body.status === "suspended" && params.id === session.userId) {
    return NextResponse.json({ error: "You cannot suspend your own account." }, { status: 400 });
  }

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

    // Tell the contributor their status changed — otherwise an approval or
    // rejection is silent and they have no way to know they can now log in
    // (or that their application didn't go through). Best-effort: never
    // blocks the response, since createNotification() itself never throws.
    if (nextStatus && nextStatus !== target.status && target.role === "contributor") {
      const notifyUser = {
        id: target.id,
        email: target.email,
        displayName: target.displayName,
        authProvider: target.authProvider,
        passwordHash: target.passwordHash,
      };
      if (nextStatus === "approved") {
        await notifyAccountApproved(notifyUser).catch((err) =>
          console.error("[admin/users] failed to notify account approved:", err)
        );
      } else if (nextStatus === "rejected") {
        await notifyAccountRejected(notifyUser).catch((err) =>
          console.error("[admin/users] failed to notify account rejected:", err)
        );
      }
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
  const effective = await getEffectivePermissions(session);
  const canDelete = hasPermission(effective, "contributors", "delete") || hasPermission(effective, "roles", "delete");
  if (!canDelete) {
    return NextResponse.json({ error: "You don't have permission to delete users." }, { status: 403 });
  }

  if (params.id === session.userId) {
    return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });
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
