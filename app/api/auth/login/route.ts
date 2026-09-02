import { NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE_NAME, type Session } from "@/lib/auth";
import { verifyUserCredentials, findUserByEmail, touchLastLogin } from "@/lib/users";
import { turnstileConfigured, verifyTurnstileToken } from "@/lib/turnstile";
import { DB_ERROR_MESSAGE } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// Contributor login — issued a session only if the account exists, the
// password matches, the role is "contributor", AND status is "approved".
// A pending or rejected account gets a specific, honest error rather than
// a generic "invalid credentials" — the person needs to know their account
// is still waiting on the admin, not that they mistyped their password.
export async function POST(req: Request) {
  // Brute-force protection: 8 attempts per 10 minutes per IP. Fails open
  // (allows the request) if the rate-limit table itself is unreachable, so
  // this never becomes a new way to break login entirely.
  const ip = getClientIp(req);
  const limit = await checkRateLimit(`login:${ip}`, 8, 600);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many login attempts. Please wait a few minutes and try again." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  let email = "";
  let password = "";
  let turnstileToken = "";
  try {
    const body = await req.json();
    email = (body.email || "").trim();
    password = body.password || "";
    turnstileToken = body.turnstileToken || "";
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (turnstileConfigured()) {
    const verified = await verifyTurnstileToken(turnstileToken, ip);
    if (!verified) {
      return NextResponse.json({ error: "Verification failed. Please try again." }, { status: 400 });
    }
  }

  let user;
  try {
    user = await verifyUserCredentials(email, password);
  } catch {
    return NextResponse.json({ error: DB_ERROR_MESSAGE }, { status: 500 });
  }

  if (!user || user.role !== "contributor") {
    // A Google-only account (no password set) will also fail
    // verifyUserCredentials above — give it a specific, honest message
    // instead of a generic "invalid password" that would just confuse
    // someone who never set a password in the first place.
    const existing = await findUserByEmail(email).catch(() => undefined);
    if (existing && existing.role === "contributor" && !existing.passwordHash) {
      return NextResponse.json(
        { error: "This account uses Google Sign-In. Use \"Continue with Google\" below, or set a password from your profile after logging in." },
        { status: 401 }
      );
    }
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  if (user.status === "pending") {
    // A password account that hasn't clicked its verification link yet
    // never even reaches an admin's queue (see the emailVerified filtering
    // in the Admin Panel) — so "awaiting admin approval" would be
    // misleading here. Google accounts are always emailVerified from the
    // moment they're created, so they never hit this branch.
    if (!user.emailVerified) {
      return NextResponse.json(
        { error: "Please verify your email first — check your inbox for the verification link we sent when you signed up." },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: "Your account is still awaiting admin approval. You'll be able to log in once it's approved." },
      { status: 403 }
    );
  }
  if (user.status === "rejected") {
    return NextResponse.json(
      { error: "Your account registration was not approved. Contact us if you think this is a mistake." },
      { status: 403 }
    );
  }
  if (user.status === "suspended") {
    return NextResponse.json(
      { error: "Your account has been suspended. Contact us if you think this is a mistake." },
      { status: 403 }
    );
  }

  await touchLastLogin(user.id);

  const session: Session = {
    userId: user.id,
    email: user.email,
    role: "contributor",
    displayName: user.displayName,
    cityId: user.cityId,
  };
  const token = await createSessionToken(session);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
  return res;
}
