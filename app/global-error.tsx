"use client";

// Only triggers if the root layout itself throws (rare) — Next requires
// this file to render its own <html>/<body> since it replaces the entire
// root layout in that case, so it deliberately does not import
// PublicHeader/Footer or anything else that depends on layout data.
import { useEffect } from "react";
import "./globals.css";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[global error boundary]", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <div className="flex min-h-screen flex-col items-center justify-center bg-paper px-4 text-center">
          <h1 className="font-serif text-2xl font-bold text-ink-900">Something went wrong</h1>
          <p className="mt-2 max-w-sm text-sm text-ink-500">
            The site hit an unexpected error. Please try again.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-6 rounded-md bg-signal px-4 py-2 text-sm font-semibold text-white hover:bg-signal-dark"
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
