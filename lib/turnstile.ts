// Cloudflare Turnstile (https://developers.cloudflare.com/turnstile/) —
// bot/abuse protection on the signup and login forms, on top of the
// existing per-IP rate limiting (see lib/rateLimit.ts). Same "optional,
// gracefully absent until configured" pattern as Google OAuth
// (lib/googleAuth.ts) and Resend (lib/email.ts): without
// TURNSTILE_SECRET_KEY set, the widget doesn't render client-side (see
// components/Turnstile.tsx) and this file skips verification entirely
// server-side, so local development never needs a Cloudflare account.
const VERIFY_ENDPOINT = "https://challenge.cloudflare.com/turnstile/v0/siteverify";

export function turnstileConfigured(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

// Verifies a token from the client-side widget against Cloudflare's API.
//   - Not configured -> true (skip; nothing to verify against).
//   - No token submitted while configured -> false (the form should have
//     collected one; missing means the widget was bypassed or JS-disabled).
//   - Cloudflare says success:false (real bot/expired/invalid token) ->
//     false — this is the one case that actually blocks the request.
//   - A network/infra error reaching Cloudflare itself -> true (fail open,
//     same philosophy as checkRateLimit's own infra-failure handling: a
//     third-party outage should never be the reason a real signup/login
//     fails), logged loudly so it's visible in server logs.
export async function verifyTurnstileToken(token: string | undefined | null, ip?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set("remoteip", ip);
    const res = await fetch(VERIFY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = await res.json();
    if (!data.success) {
      console.warn("[turnstile] verification failed:", data["error-codes"] || data);
    }
    return Boolean(data.success);
  } catch (err) {
    console.error("[turnstile] couldn't reach Cloudflare to verify — allowing request through:", err);
    return true;
  }
}
