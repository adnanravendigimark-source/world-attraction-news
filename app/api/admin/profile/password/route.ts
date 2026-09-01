import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { findUserById, setOwnPassword } from "@/lib/users";
import { verifyPassword } from "@/lib/passwords";
import { logActivity } from "@/lib/activity";
import { dbErrorMessage } from "@/lib/db";

export const dynamic = "force-dynamic";

// Admin password change. Only works for a DB-backed admin account (one
// promoted via Admin -> Users) — the ADMIN_EMAIL/ADMIN_PASSWORD "owner"
// account isn't a row in the database at all, so there's nothing here to
// update; that account's credentials are only ever changed by editing the
// deployment's environment variables. The route returns a clear error in
// that case rather than pretending to succeed.
export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.userId === "owner") {
    return NextResponse.json(
      { error: "The owner account's password is set via ADMIN_PASSWORD in your environment variables, not here." },
      { status: 400 }
    );
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
