"use client";

// Google reCAPTCHA v3 — fully invisible, no checkbox, no widget to render.
// Instead, right before a protected form submits, we ask Google's script
// to silently score this page load/interaction and hand back a short-lived
// token, which the server then verifies in lib/recaptcha.ts. Renders
// nothing when NEXT_PUBLIC_RECAPTCHA_SITE_KEY isn't set — matches
// lib/recaptcha.ts's server-side skip, same "gracefully absent until
// configured" pattern used across this app.
declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, opts: { action: string }) => Promise<string>;
    };
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
export const RECAPTCHA_ENABLED = Boolean(SITE_KEY);

let scriptLoadPromise: Promise<void> | null = null;

function loadRecaptchaScript(): Promise<void> {
  if (window.grecaptcha?.execute) return Promise.resolve();
  if (scriptLoadPromise) return scriptLoadPromise;
  const src = `https://www.google.com/recaptcha/api.js?render=${SITE_KEY}`;
  scriptLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load reCAPTCHA script")));
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load reCAPTCHA script"));
    document.head.appendChild(script);
  });
  return scriptLoadPromise;
}

// Fetches a fresh, single-use v3 token for the given action (e.g.
// "login", "signup", "admin_login" — matched loosely against the server's
// expectedAction in lib/recaptcha.ts). Resolves to null — never throws —
// if the script can't load in time (blocked DNS/network, ad-blocker,
// etc.) or times out, so the caller can submit anyway and let the server's
// own fail-open-on-missing-token behavior take over. This mirrors the
// fix applied after the earlier Cloudflare Turnstile DNS-lockout bug: a
// third-party script being unreachable must never hard-block a real
// signup/login.
export async function getRecaptchaToken(action: string): Promise<string | null> {
  if (!SITE_KEY) return null;
  try {
    await Promise.race([
      loadRecaptchaScript(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("reCAPTCHA load timed out")), 8000)),
    ]);
    if (!window.grecaptcha) return null;
    return await new Promise<string>((resolve, reject) => {
      window.grecaptcha!.ready(() => {
        window.grecaptcha!.execute(SITE_KEY, { action }).then(resolve).catch(reject);
      });
    });
  } catch (err) {
    console.error("[recaptcha]", err);
    return null;
  }
}
