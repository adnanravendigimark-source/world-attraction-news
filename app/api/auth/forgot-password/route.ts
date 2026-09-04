import { NextResponse } from "next/server";
import { setPasswordResetToken } from "@/lib/users";
import { generateResetToken } from "@/lib/tokens";
import { sendPasswordResetEmail } from "@/lib/email";
import { dbErrorMessage } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { getAppUrl } from "@/lib/appUrl";

export const dynamic = "force-dynamic";

// Deliberately responds with the same { ok: true } message whether or not
// the email is registered — never reveal via this endpoint which emails
// have accounts (a standard anti-enumeration precaution).
export async function POST(req: Request) {
  // Prevents using this endpoint to spam a mailbox with reset emails — 5
  // requests per hour per IP.
  const ip = getClientIp(req);
  const limit = await checkRateLimit(`forgot-password:${ip}`, 5, 3600);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  let email = "";
  try {
    const body = await req.json();
    email = (body.email || "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  try {
    const { raw, hash, expiresAt } = generateResetToken();
    const user = await setPasswordResetToken(email, hash, expiresAt);
    if (user) {
      const resetUrl = `${getAppUrl(req)}/reset-password?token=${raw}`;
      await sendPasswordResetEmail(user.email, resetUrl);
      // Dev convenience only: when no email provider is configured, echo
      // the link back so the reset flow can still be tested locally. Never
      // included once RESEND_API_KEY is set / in production.
      if (!process.env.RESEND_API_KEY && process.env.NODE_ENV !== "production") {
        return NextResponse.json({ ok: true, devResetUrl: resetUrl });
      }
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}
