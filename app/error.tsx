"use client";

import { useEffect } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";

// Catches unexpected render/data errors anywhere under the root layout
// (e.g. a page component throwing) and shows a real, on-brand recovery
// screen instead of Next's default error overlay in production.
export default function GlobalErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app error boundary]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-paper px-4 text-center">
      <Logo className="h-10 w-10" />
      <h1 className="mt-6 font-serif text-2xl font-bold text-ink-900">Something went wrong</h1>
      <p className="mt-2 max-w-sm text-sm text-ink-500">
        We hit an unexpected error loading this page. It's been logged — try again, or head back to the homepage.
      </p>
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-md border border-ink-300 px-4 py-2 text-sm font-semibold text-ink-700 hover:border-ink-900"
        >
          Try Again
        </button>
        <Link href="/" className="rounded-md bg-signal px-4 py-2 text-sm font-semibold text-white hover:bg-signal-dark">
          Back to Homepage
        </Link>
      </div>
    </div>
  );
}
