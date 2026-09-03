import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { findUserById, setOwnPassword } from "@/lib/users";
import { getOwnerPasswordHash, setOwnerPasswordHash } from "@/lib/settings";
import { hashPassword, verifyPassword } from "@/lib/passwords";
import { logActivity } from "@/lib/activity";
import { dbErrorMessage } from "@/lib/db";

export const dynamic = "force-dynamic";

// Admin password change. Handles both kinds of admin session:
//   - A DB-backed admin account (one promoted via Admin -> Users) — updates
//     users.password_hash via setOwnPassword(), same as any contributor.
//   - The ADMIN_EMAIL/ADMIN_PASSWORD "owner" account, which isn't a row in
//     the database — its password override lives on the settings table
//     instead (settings.owner_password_hash, see lib/settings.ts). Once
//     set, app/api/auth/admin-login/route.ts checks that hash instead of
//     ADMIN_PASSWORD from the environment, so this genuinely replaces the
//     env-only workflow rather than just adding to it.
export async function POST(req: Request) {
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
  const currentPassword = body.currentPassword || "";
  const newPassword = body.newPassword || "";
  if (newPassword.length < 8) {
    return NextResponse.json({ error: "New password must be at least 8 characters." }, { status: 400 });
  }

  try {
    if (session.userId === "owner") {
      const ownerHash = await getOwnerPasswordHash();
      const ownerEnvPassword = process.env.ADMIN_PASSWORD || "";
      const currentOk = ownerHash
        ? verifyPassword(currentPassword, ownerHash)
        : Boolean(currentPassword && currentPassword === ownerEnvPassword);
      if (!currentOk) {
        return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
      }
      await setOwnerPasswordHash(hashPassword(newPassword));
      await logActivity(session, "admin_password_changed", { type: "user", id: "owner", label: session.email });
      return NextResponse.json({ ok: true });
    }

    const user = await findUserById(session.userId);
    if (!user) return NextResponse.json({ error: "Account not found." }, { status: 404 });
    if (user.passwordHash) {
      if (!currentPassword || !verifyPassword(currentPassword, user.passwordHash)) {
        return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
      }
    }
    await setOwnPassword(session.userId, newPassword);
    await logActivity(session, "admin_password_changed", { type: "user", id: session.userId, label: session.email });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}
