import { NextResponse } from "next/server";
import { googleOAuthConfigured, getGoogleAuthUrl } from "@/lib/googleAuth";
import { generateOAuthState } from "@/lib/tokens";

export const dynamic = "force-dynamic";

// Step 1 of the Google OAuth flow — redirects the browser to Google's
// consent screen. A random `state` value is stored in a short-lived,
// httpOnly cookie and re-checked on the callback so a forged callback
// request (CSRF) is rejected.
export async function GET() {
  if (!googleOAuthConfigured()) {
    const url = new URL("/login?error=google_not_configured", process.env.APP_URL || "http://localhost:3000");
    return NextResponse.redirect(url);
  }

  const state = generateOAuthState();
  const res = NextResponse.redirect(getGoogleAuthUrl(state));
  res.cookies.set("atn_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10, // 10 minutes — just long enough to complete the redirect round trip
  });
  return res;
}
