"use client";

import { useEffect, useRef } from "react";

// Google reCAPTCHA v2 ("I'm not a robot" checkbox) widget. Renders nothing
// at all when NEXT_PUBLIC_RECAPTCHA_SITE_KEY isn't set — matches
// lib/recaptcha.ts's server-side skip, so an unconfigured environment
// (e.g. local dev with no Google account) never shows a broken/empty box,
// it just silently omits the check on both ends.
declare global {
  interface Window {
    grecaptcha?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => number;
      reset: (widgetId: number) => void;
    };
    // reCAPTCHA's own bootstrap requires a global callback name for its
    // async script load — no clean promise-based API is offered.
    __onRecaptchaLoad?: () => void;
  }
}

const SCRIPT_SRC = "https://www.google.com/recaptcha/api.js?onload=__onRecaptchaLoad&render=explicit";
let scriptLoadPromise: Promise<void> | null = null;

function loadRecaptchaScript(): Promise<void> {
  if (window.grecaptcha?.render) return Promise.resolve();
  if (scriptLoadPromise) return scriptLoadPromise;
  scriptLoadPromise = new Promise((resolve, reject) => {
    window.__onRecaptchaLoad = () => resolve();
    const existing = document.querySelector(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener("error", () => reject(new Error("Failed to load reCAPTCHA script")));
      return;
    }
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error("Failed to load reCAPTCHA script"));
    document.head.appendChild(script);
  });
  return scriptLoadPromise;
}

export default function Recaptcha({
  onVerify,
  onExpire,
  onError,
}: {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  // Fires when the widget itself can never appear — the script failed to
  // load (blocked by a DNS filter/ad-blocker/network issue) or timed out.
  // The parent form should treat this as "reCAPTCHA is unavailable" and
  // stop requiring a token, rather than leaving the submit button
  // disabled forever over a third-party outage the visitor has no way to
  // fix. See lib/recaptcha.ts for the matching server-side behavior.
  onError?: () => void;
}) {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!siteKey) return;
    let cancelled = false;

    // If the script neither loads nor errors within a few seconds (some
    // network/DNS failures hang rather than firing an error event),
    // surface it the same way as an outright load failure.
    const timeout = setTimeout(() => {
      if (!cancelled && !window.grecaptcha?.render) {
        console.error("[recaptcha] timed out waiting for the script to load");
        onError?.();
      }
    }, 8000);

    loadRecaptchaScript()
      .then(() => {
        clearTimeout(timeout);
        if (cancelled || !containerRef.current || !window.grecaptcha) return;
        widgetIdRef.current = window.grecaptcha.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token: string) => onVerify(token),
          "expired-callback": () => onExpire?.(),
          "error-callback": () => onError?.(),
        });
      })
      .catch((err) => {
        clearTimeout(timeout);
        console.error("[recaptcha]", err);
        onError?.();
      });

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey]);

  if (!siteKey) return null;
  return <div ref={containerRef} className="flex justify-center" />;
}
