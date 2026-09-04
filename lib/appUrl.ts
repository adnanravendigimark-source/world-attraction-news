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
import { SITE_URL } from "./site";

function normalizeAppUrlEnv(raw: string): string {
  const trimmed = raw.trim().replace(/\/$/, "");
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function getOriginFromRequest(req: Request): string | null {
  try {
    const forwardedHost = req.headers.get("x-forwarded-host");
    const host = forwardedHost || req.headers.get("host");
    const forwardedProto = req.headers.get("x-forwarded-proto");
    const isLocal = host ? host.includes("localhost") || host.includes("127.0.0.1") : false;
    const proto = forwardedProto || (isLocal ? "http" : "https");

    if (host) {
      const cleanHost = host.split(",")[0].trim();
      return `${proto}://${cleanHost}`;
    }

    const parsed = new URL(req.url);
    if (parsed.origin && parsed.origin !== "null") {
      return parsed.origin;
    }
  } catch {
    // fall through
  }
  return null;
}

export function getAppUrl(req?: Request): string {
  // 1. If a Request is available, inspect its real runtime origin (x-forwarded-host, host header, req.url)
  if (req) {
    const origin = getOriginFromRequest(req);
    if (origin) return origin;
  }

  // 2. Check APP_URL env if provided
  const envValue = process.env.APP_URL?.trim();
  if (envValue) {
    try {
      const normalized = normalizeAppUrlEnv(envValue);
      const url = new URL(normalized);
      const isLocalEnv = url.hostname === "localhost" || url.hostname === "127.0.0.1";
      if (!isLocalEnv || process.env.NODE_ENV !== "production") {
        return url.origin;
      }
    } catch {
      // fall through
    }
  }

  // 3. In production, fallback to the canonical SITE_URL
  if (process.env.NODE_ENV === "production" && SITE_URL) {
    try {
      return new URL(normalizeAppUrlEnv(SITE_URL)).origin;
    } catch {
      // fall through
    }
  }

  return "http://localhost:3000";
}
