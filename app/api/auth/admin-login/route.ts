import { NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE_NAME, type Session } from "@/lib/auth";
import { verifyUserCredentials, touchLastLogin } from "@/lib/users";
import { getOwnerPasswordHash } from "@/lib/settings";
import { verifyPassword } from "@/lib/passwords";
import { recaptchaConfigured, verifyRecaptchaToken } from "@/lib/recaptcha";
import { DB_ERROR_MESSAGE } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// Admin Panel login. Two ways in:
//   1. The .env "owner" account (ADMIN_EMAIL / ADMIN_PASSWORD) — always
//      valid, works even before the database has any rows in it. This is
//      what you use for the very first login on a fresh database. Once the
//      owner changes their password from Admin -> Settings, that hash
//      (stored in settings.owner_password_hash — see lib/settings.ts) takes
//      over and ADMIN_PASSWORD is ignored; it's only the fallback for as
//      long as no override has been set.
//   2. Any user in the database with role "admin" (promoted from the Admin
//      Panel's Users page after the owner account has logged in once).
export async function POST(req: Request) {
  // Stricter than contributor login — the Admin Panel is the highest-value
  // target on the site. 6 attempts per 15 minutes per IP.
  const ip = getClientIp(req);
  const limit = await checkRateLimit(`admin-login:${ip}`, 6, 900);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many login attempts. Please wait a few minutes and try again." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  let email = "";
  let password = "";
  let recaptchaToken = "";
  try {
    const body = await req.json();
    email = (body.email || "").trim();
    password = body.password || "";
    recaptchaToken = body.recaptchaToken || "";
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (recaptchaConfigured()) {
    const verified = await verifyRecaptchaToken(recaptchaToken, ip);
    if (!verified) {
      return NextResponse.json({ error: "Verification failed. Please try again." }, { status: 400 });
    }
  }

  const ownerEmail = process.env.ADMIN_EMAIL;
  const ownerPassword = process.env.ADMIN_PASSWORD;
  let session: Session | null = null;

  if (ownerEmail && email.toLowerCase() === ownerEmail.toLowerCase()) {
    let ownerHash = "";
    try {
      ownerHash = await getOwnerPasswordHash();
    } catch {
      // Settings table unreachable — fall back to the env password below
      // rather than locking the owner out over a transient DB error.
    }
    const passwordOk = ownerHash ? verifyPassword(password, ownerHash) : Boolean(ownerPassword && password === ownerPassword);
    if (passwordOk) {
      session = { userId: "owner", email: ownerEmail, role: "admin", displayName: "Site Owner", cityId: null };
    }
  } else {
    let user;
    try {
      user = await verifyUserCredentials(email, password);
    } catch {
      return NextResponse.json({ error: DB_ERROR_MESSAGE }, { status: 500 });
    }
    if (user && user.role === "admin") {
      session = { userId: user.id, email: user.email, role: "admin", displayName: user.displayName, cityId: null };
      await touchLastLogin(user.id);
    }
  }

  if (!session) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  const token = await createSessionToken(session, 60 * 60 * 8); // 8 hours — matches cookie maxAge below
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8, // 8 hours
  });
  return res;
}
