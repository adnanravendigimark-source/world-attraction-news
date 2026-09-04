// Single source of truth for "what is this deployment's own runtime base
// URL" — used anywhere the server needs to build an absolute link back to
// itself (OAuth redirect URIs, password-reset/verify-email links, an OAuth
// callback's post-login redirect). This is deliberately NOT the same thing
// as lib/site.ts's SITE_URL, which is the fixed public marketing domain
// used for canonical tags/SEO/sitemaps — APP_URL is whatever host this
// specific running instance is actually reachable at (a Vercel preview
// deployment, a custom domain, or localhost in dev), and can legitimately
// differ from SITE_URL.
//
// Every caller used to inline its own `process.env.APP_URL || "http://
// localhost:3000"` fallback. That hardcoded localhost fallback is exactly
// how the Google OAuth callback could get stuck showing its own
// `/api/auth/google/callback?code=...` URL instead of completing the
// redirect: if APP_URL isn't set (or is set without a scheme, e.g.
// "myapp.vercel.app" instead of "https://myapp.vercel.app") in a deployed
// environment, `new URL(path, base)` either points at an unreachable
// localhost or throws outright — and a thrown error inside a route handler
// that hasn't sent a redirect yet leaves the browser exactly where it was:
// sitting on the callback URL with the error page rendered in place of it.
//
// Fixed here by preferring, in order: (1) APP_URL from the environment,
// normalized to always carry a scheme, when it's set; (2) the incoming
// request's own origin, which is always a valid, currently-reachable URL
// for whatever host actually served this request — the right fallback for
// a deployment where APP_URL was simply never configured; (3) localhost,
// only for contexts with no request at hand (e.g. a script run outside any
// HTTP request).
function normalizeAppUrlEnv(raw: string): string {
  const trimmed = raw.trim().replace(/\/$/, "");
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function getAppUrl(req?: Request): string {
  const envValue = process.env.APP_URL?.trim();
  if (envValue) {
    try {
      // Validate it actually parses as a URL before trusting it — a
      // malformed value (stray spaces, no host, etc.) falls through to the
      // request-derived origin below instead of producing a broken redirect
      // target.
      return new URL(normalizeAppUrlEnv(envValue)).origin;
    } catch {
      // fall through
    }
  }
  if (req) {
    try {
      return new URL(req.url).origin;
    } catch {
      // fall through
    }
  }
  return "http://localhost:3000";
}
