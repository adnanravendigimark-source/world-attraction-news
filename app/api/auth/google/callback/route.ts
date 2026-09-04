import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeGoogleCode, googleOAuthConfigured } from "@/lib/googleAuth";
import { findOrCreateGoogleUser, touchLastLogin } from "@/lib/users";
import { createSessionToken, SESSION_COOKIE_NAME, type Session } from "@/lib/auth";
import { sendWelcomeEmail } from "@/lib/email";
import { getAppUrl } from "@/lib/appUrl";

export const dynamic = "force-dynamic";

// Builds the redirect off THIS request's own origin whenever APP_URL isn't
// set (see lib/appUrl.ts) — this is what stops the callback from getting
// stuck showing its own `/api/auth/google/callback?code=...` URL: a plain
// `process.env.APP_URL || "http://localhost:3000"` fallback here used to
// build an unreachable localhost redirect target (or throw on a malformed
// APP_URL) in any deployed environment where APP_URL wasn't configured,
// which left the browser sitting on the last real page it loaded — this
// callback URL itself — instead of completing the navigation.
function redirectTo(path: string, req: Request) {
  return NextResponse.redirect(new URL(path, getAppUrl(req)));
}

// The `atn_oauth_state` cookie is single-use and only meant to live for the
// ~10-minute round trip to Google and back (see app/api/auth/google/route.ts).
// Every exit from this handler — success, a mismatched/missing state, a
// denied consent screen, an unverified email, a pending/rejected account, or
// an unexpected error — should consume it so a stale value can't be reused
// on a retry and doesn't linger in the browser longer than it has to.
function redirectAndClearState(path: string, req: Request) {
  const res = redirectTo(path, req);
  res.cookies.set("atn_oauth_state", "", { path: "/", maxAge: 0 });
  return res;
}

// Step 2 of the Google OAuth flow. Verifies the `state` cookie, exchanges
// the authorization code for an identity token, then finds/creates/links
// the account. A brand-new or still-pending account is sent to
// /pending-approval WITHOUT a session — Google sign-in doesn't skip the
// same admin-approval gate that email/password signup goes through.
export async function GET(req: Request) {
  if (!googleOAuthConfigured()) return redirectTo("/login?error=google_not_configured", req);

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  if (error) return redirectAndClearState("/login?error=google_denied", req);

  const cookieState = cookies().get("atn_oauth_state")?.value;

  if (!code || !state || !cookieState || state !== cookieState) {
    return redirectAndClearState("/login?error=google_state_mismatch", req);
  }

  try {
    const profile = await exchangeGoogleCode(code, req);
    if (!profile.emailVerified) {
      return redirectAndClearState("/login?error=google_email_unverified", req);
    }

    const { user, isNewAccount } = await findOrCreateGoogleUser({
      googleId: profile.googleId,
      email: profile.email,
      name: profile.name,
      avatarUrl: profile.avatarUrl,
    });

    // Only after the account row exists — same welcome email as
    // password-based signup, since a new Google contributor account still
    // lands in "pending" and needs the same "you're pending approval"
    // notice.
    if (isNewAccount) {
      try {
        await sendWelcomeEmail(user.email, user.displayName);
      } catch (err) {
        console.error("[google oauth callback] welcome email failed:", err);
      }
    }

    if (user.role !== "contributor" || user.status !== "approved") {
      const errorParam =
        user.status === "rejected" ? "account_rejected" : user.status === "suspended" ? "account_suspended" : "";
      return redirectAndClearState(errorParam ? `/login?error=${errorParam}` : "/pending-approval", req);
    }

    await touchLastLogin(user.id);

    const session: Session = {
      userId: user.id,
      email: user.email,
      role: "contributor",
      displayName: user.displayName,
      cityId: user.cityId,
    };
    const token = await createSessionToken(session, 60 * 60 * 24 * 7); // 7 days — matches cookie maxAge below
    // The actual, final user-facing page after a successful sign-in — the
    // browser should never be left sitting on this callback route itself.
    const res = redirectTo("/contributor/dashboard", req);
    res.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    res.cookies.set("atn_oauth_state", "", { path: "/", maxAge: 0 });
    return res;
  } catch (err) {
    // Logged server-side so the actual cause (token exchange failure, a DB
    // error from a schema that's missing the Phase 1 columns, etc.) shows
    // up in the terminal instead of only a generic message in the browser.
    console.error("[google oauth callback] failed:", err);
    return redirectAndClearState("/login?error=google_failed", req);
  }
}
