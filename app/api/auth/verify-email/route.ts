import { NextResponse } from "next/server";
import { consumeEmailVerifyToken } from "@/lib/users";
import { sendWelcomeEmail } from "@/lib/email";
import { dbErrorMessage } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // Limits brute-forcing a guessed/leaked verify token — 10 attempts per
  // 30 minutes per IP, same shape as reset-password's guard. The token
  // itself (long, random, single-use, time-limited) is still the real
  // security boundary.
  const ip = getClientIp(req);
  const limit = await checkRateLimit(`verify-email:${ip}`, 10, 1800);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  let token = "";
  try {
    const body = await req.json();
    token = (body.token || "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!token) return NextResponse.json({ error: "Missing verification token." }, { status: 400 });

  try {
    const user = await consumeEmailVerifyToken(token);
    if (!user) {
      return NextResponse.json(
        { error: "This verification link is invalid or has expired. Try signing up again to get a new one." },
        { status: 400 }
      );
    }

    // Only now — verified — does the "you're pending approval" email go
    // out, and only now does this account become visible to admins for
    // review (see the emailVerified filtering in the Admin Panel).
    try {
      await sendWelcomeEmail(user.email, user.displayName);
    } catch (err) {
      console.error("[verify-email] welcome email failed:", err);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}
