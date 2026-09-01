import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { findUserById, setOwnPassword } from "@/lib/users";
import { verifyPassword } from "@/lib/passwords";
import { dbErrorMessage } from "@/lib/db";

export const dynamic = "force-dynamic";

// A Google-only account (no password_hash yet) can use this to *set* its
// first password — no "current password" is required in that case, since
// there isn't one yet. Every other account must supply the correct current
// password first.
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}
