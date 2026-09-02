"use client";

import { useEffect, useRef } from "react";

// Cloudflare Turnstile widget. Renders nothing at all when
// NEXT_PUBLIC_TURNSTILE_SITE_KEY isn't set — matches lib/turnstile.ts's
// server-side skip, so an unconfigured environment (e.g. local dev with no
// Cloudflare account) never shows a broken/empty box, it just silently
// omits the check on both ends.
declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      remove: (widgetId: string) => void;
      reset: (widgetId: string) => void;
    };
  }
}

const SCRIPT_SRC = "https://challenge.cloudflare.com/turnstile/v0/api.js";
let scriptLoadPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (scriptLoadPromise) return scriptLoadPromise;
  scriptLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Turnstile script")));
      return;
    }
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Turnstile script"));
    document.head.appendChild(script);
  });
  return scriptLoadPromise;
}

export default function Turnstile({
  onVerify,
  onExpire,
  onError,
}: {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  // Fires when the widget itself can never appear — the api.js script
  // failed to load (blocked by a DNS filter/ad-blocker/network issue) or
  // timed out. The parent form should treat this as "Turnstile is
  // unavailable" and stop requiring a token, rather than leaving the
  // submit button disabled forever over a third-party outage the visitor
  // has no way to fix. See lib/turnstile.ts for the matching server-side
  // behavior.
  onError?: () => void;
}) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!siteKey) return;
    let cancelled = false;

    // If the script neither loads nor errors within a few seconds (some
    // network/DNS failures hang rather than firing an error event),
    // surface it the same way as an outright load failure.
    const timeout = setTimeout(() => {
      if (!cancelled && !window.turnstile) {
        console.error("[turnstile] timed out waiting for the script to load");
        onError?.();
      }
    }, 8000);

    loadTurnstileScript()
      .then(() => {
        clearTimeout(timeout);
        if (cancelled || !containerRef.current || !window.turnstile) return;
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token: string) => onVerify(token),
          "expired-callback": () => onExpire?.(),
          "error-callback": () => onError?.(),
        });
      })
      .catch((err) => {
        clearTimeout(timeout);
        console.error("[turnstile]", err);
        onError?.();
      });

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey]);

  if (!siteKey) return null;
  return <div ref={containerRef} className="flex justify-center" />;
}
