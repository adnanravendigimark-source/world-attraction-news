import { NextResponse } from "next/server";
import { registerContributor, setEmailVerifyToken } from "@/lib/users";
import { sendVerifyEmail } from "@/lib/email";
import { generateVerifyToken } from "@/lib/tokens";
import { recaptchaConfigured, verifyRecaptchaToken } from "@/lib/recaptcha";
import { dbErrorMessage } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// Public contributor signup — always creates role "contributor", status
// "pending". There is no way to reach role "admin" through this endpoint;
// admins can only be promoted from the Admin Panel by an existing admin.
//
// Password signups additionally require email verification before an
// admin ever sees the application (see lib/users.ts's emailVerified
// column and /api/auth/verify-email) — this route creates the account,
// generates a verify token, and emails a verify link instead of the
// "you're pending approval" welcome email; that welcome email only goes
// out once the link is clicked. Google signups skip all of this, since
// Google already verified the email before the account was ever created.
export async function POST(req: Request) {
  // Limits automated mass account creation — 5 signups per hour per IP.
  const ip = getClientIp(req);
  const limit = await checkRateLimit(`signup:${ip}`, 5, 3600);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many signup attempts from this connection. Please try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (recaptchaConfigured()) {
    const verified = await verifyRecaptchaToken(body.recaptchaToken, ip);
    if (!verified) {
      return NextResponse.json({ error: "Verification failed. Please try again." }, { status: 400 });
    }
  }

  const email = (body.email || "").trim();
  const password = body.password || "";
  const displayName = (body.displayName || "").trim();
  const bio = (body.bio || "").trim();

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }
  if (!displayName) {
    return NextResponse.json({ error: "Enter your name." }, { status: 400 });
  }

  let user;
  try {
    user = await registerContributor({ email, password, displayName, bio });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message.includes("already exists")) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }

  // Fire only after the account row exists. Never allowed to fail the
  // signup response itself — sendVerifyEmail already never throws, but
  // this extra try/catch is defense in depth.
  try {
    const { raw, hash, expiresAt } = generateVerifyToken();
    await setEmailVerifyToken(user.id, hash, expiresAt);
    const appUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
    const verifyUrl = `${appUrl}/verify-email?token=${raw}`;
    await sendVerifyEmail(email, { displayName, verifyUrl });
  } catch (err) {
    console.error("[signup] verify email failed:", err);
  }

  return NextResponse.json({ ok: true });
}
