// Google reCAPTCHA v2 ("I'm not a robot" checkbox) — bot/abuse protection
// on the signup, login, and admin login forms, on top of the existing
// per-IP rate limiting (see lib/rateLimit.ts). Same "optional, gracefully
// absent until configured" pattern as Google OAuth (lib/googleAuth.ts) and
// Resend (lib/email.ts): without RECAPTCHA_SECRET_KEY set, the widget
// doesn't render client-side (see components/Recaptcha.tsx) and this file
// skips verification entirely server-side, so local development never
// needs a Google account for this.
const VERIFY_ENDPOINT = "https://www.google.com/recaptcha/api/siteverify";

export function recaptchaConfigured(): boolean {
  return Boolean(process.env.RECAPTCHA_SECRET_KEY);
}

// Verifies a token from the client-side widget against Google's API.
//   - Not configured -> true (skip; nothing to verify against).
//   - No token submitted while configured -> true (fail open). A missing
//     token most often means the widget itself couldn't load (blocked by
//     a DNS filter/ad-blocker/network issue — see components/Recaptcha.tsx,
//     which reports that case to the form instead of leaving it stuck) —
//     the same real-world failure mode we hit with Cloudflare Turnstile.
//     reCAPTCHA is a supplementary layer on top of the real defense
//     (per-IP rate limiting), so a third-party widget being unreachable
//     should never hard-block a genuine signup/login. Logged so it's
//     visible in server logs.
//   - Google says success:false (real bot/expired/invalid token) -> false
//     — this is the one case that actually blocks the request.
//   - A network/infra error reaching Google itself -> true (fail open,
//     same philosophy as checkRateLimit's own infra-failure handling: a
//     third-party outage should never be the reason a real signup/login
//     fails), logged loudly so it's visible in server logs.
export async function verifyRecaptchaToken(token: string | undefined | null, ip?: string): Promise<boolean> {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) return true;
  if (!token) {
    console.warn("[recaptcha] no token submitted — allowing through (rate limiting is the backstop here)");
    return true;
  }

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
      console.warn("[recaptcha] verification failed:", data["error-codes"] || data);
    }
    return Boolean(data.success);
  } catch (err) {
    console.error("[recaptcha] couldn't reach Google to verify — allowing request through:", err);
    return true;
  }
}
