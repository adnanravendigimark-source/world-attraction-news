// Google reCAPTCHA v3 — invisible bot/abuse scoring on the signup, login,
// and admin login forms, on top of the existing per-IP rate limiting (see
// lib/rateLimit.ts). Unlike v2's checkbox, v3 has no widget to render at
// all: lib/recaptchaClient.ts silently fetches a fresh token right before
// each form submits, and this file scores it server-side. Same "optional,
// gracefully absent until configured" pattern as Google OAuth
// (lib/googleAuth.ts) and Resend (lib/email.ts): without
// RECAPTCHA_SECRET_KEY set, this file skips verification entirely.
const VERIFY_ENDPOINT = "https://www.google.com/recaptcha/api/siteverify";

// 0.0 (definitely a bot) to 1.0 (definitely human) — Google's own
// suggested default cutoff. Override with RECAPTCHA_MIN_SCORE if this
// site needs to be stricter or looser.
const DEFAULT_MIN_SCORE = 0.5;

export function recaptchaConfigured(): boolean {
  return Boolean(process.env.RECAPTCHA_SECRET_KEY);
}

// Verifies a v3 token against Google's API.
//   - Not configured -> true (skip; nothing to verify against).
//   - No token submitted while configured -> true (fail open). A missing
//     token most often means the background script itself couldn't load
//     (blocked by a DNS filter/ad-blocker/network issue — see
//     lib/recaptchaClient.ts, which reports that case to the caller
//     instead of hanging) — the same real-world failure mode we hit with
//     Cloudflare Turnstile. reCAPTCHA is a supplementary layer on top of
//     the real defense (per-IP rate limiting), so a third-party script
//     being unreachable should never hard-block a genuine signup/login.
//     Logged so it's visible in server logs.
//   - Google says success:false, or success:true but score below the
//     threshold (real bot / low-confidence traffic) -> false — this is
//     the one case that actually blocks the request.
//   - A network/infra error reaching Google itself -> true (fail open,
//     same philosophy as checkRateLimit's own infra-failure handling: a
//     third-party outage should never be the reason a real signup/login
//     fails), logged loudly so it's visible in server logs.
export async function verifyRecaptchaToken(
  token: string | undefined | null,
  ip?: string,
  expectedAction?: string
): Promise<boolean> {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) return true;
  if (!token) {
    console.warn("[recaptcha] no token submitted — allowing through (rate limiting is the backstop here)");
    return true;
  }

  const minScore = Number(process.env.RECAPTCHA_MIN_SCORE) || DEFAULT_MIN_SCORE;

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
      return false;
    }
    if (expectedAction && data.action && data.action !== expectedAction) {
      // Doesn't necessarily mean abuse (could just be a stale token from a
      // different form) — log it but don't block on action mismatch alone,
      // the score check below is the real signal.
      console.warn(`[recaptcha] action mismatch: expected "${expectedAction}", got "${data.action}"`);
    }
    if (typeof data.score === "number" && data.score < minScore) {
      console.warn(`[recaptcha] score ${data.score} below threshold ${minScore}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[recaptcha] couldn't reach Google to verify — allowing request through:", err);
    return true;
  }
}
