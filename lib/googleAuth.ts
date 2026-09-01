// Google OAuth 2.0 / OIDC "Authorization Code" flow, implemented directly
// with fetch() calls rather than a client library — no new dependency to
// add and verify in an environment where `npm install` can't be run.
//
// Setup (see README.md for the full walkthrough):
//   1. Create an OAuth 2.0 Client ID (type "Web application") in the Google
//      Cloud Console: https://console.cloud.google.com/apis/credentials
//   2. Add an Authorized redirect URI of `${APP_URL}/api/auth/google/callback`
//      for both your local dev URL and your production URL.
//   3. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and APP_URL in your .env.
//
// Until those three env vars are set, the "Continue with Google" button
// shows a clear error instead of a broken redirect — see the /api/auth/google
// route.
const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

export function googleOAuthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function getAppUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function getGoogleRedirectUri(): string {
  return `${getAppUrl()}/api/auth/google/callback`;
}

export function getGoogleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    redirect_uri: getGoogleRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
}

export interface GoogleProfile {
  googleId: string;
  email: string;
  emailVerified: boolean;
  name: string;
  avatarUrl: string;
}

// Exchanges the one-time authorization `code` (from the callback query
// string) for tokens, then decodes the returned `id_token` JWT payload.
// The id_token arrives over a direct, server-to-server HTTPS call to
// Google's own token endpoint (authenticated with our client secret), so
// this deliberately skips re-verifying its signature — it never passed
// through the browser or any untrusted hop.
export async function exchangeGoogleCode(code: string): Promise<GoogleProfile> {
  const res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      redirect_uri: getGoogleRedirectUri(),
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    throw new Error("Google sign-in failed — the authorization code could not be exchanged.");
  }

  const data = await res.json();
  const idToken = data.id_token as string | undefined;
  if (!idToken) throw new Error("Google sign-in failed — no identity token was returned.");

  const payloadB64 = idToken.split(".")[1];
  if (!payloadB64) throw new Error("Google sign-in failed — malformed identity token.");
  const payload = JSON.parse(Buffer.from(payloadB64, "base64").toString("utf-8"));

  if (!payload.sub || !payload.email) {
    throw new Error("Google sign-in failed — the identity token was missing required fields.");
  }

  return {
    googleId: String(payload.sub),
    email: String(payload.email).toLowerCase(),
    emailVerified: Boolean(payload.email_verified),
    name: payload.name || payload.given_name || "",
    avatarUrl: payload.picture || "",
  };
}
