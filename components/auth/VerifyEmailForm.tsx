"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function VerifyEmailForm() {
  const searchParams = useSearchParams();
  const token = searchParams?.get("token") || "";
  const [status, setStatus] = useState<"idle" | "verifying" | "done" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setStatus("verifying");
    (async () => {
      try {
        const res = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error || "Something went wrong.");
          setStatus("error");
        } else {
          setStatus("done");
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Something went wrong.");
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!token) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 space-y-2">
        <p className="font-semibold">Missing Verification Token</p>
        <p>
          This verification link is incomplete. Check your inbox for the confirmation email or{" "}
          <Link href="/signup" className="font-bold text-[#DC2626] underline">
            apply again
          </Link>
          .
        </p>
      </div>
    );
  }

  if (status === "verifying" || status === "idle") {
    return (
      <div className="py-6 text-center space-y-2">
        <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-[#DC2626]" />
        <p className="text-xs text-slate-500 font-medium">Verifying your email address...</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-center space-y-3">
        <p className="text-xs font-semibold text-rose-800">{error || "Verification failed."}</p>
        <Link
          href="/signup"
          className="inline-block rounded-xl bg-[#0B1527] px-4 py-2 text-xs font-bold text-white hover:bg-[#DC2626] transition-colors"
        >
          Submit New Application →
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-6 text-center space-y-3">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xl font-bold">
        ✓
      </div>
      <h2 className="text-base font-bold text-slate-900">Email Confirmed</h2>
      <p className="text-xs text-slate-600 leading-relaxed">
        Your email address has been verified. Your application has been sent to our editorial desk for access approval.
      </p>
      <div className="pt-2">
        <Link
          href="/login"
          className="inline-block rounded-xl bg-[#0B1527] px-4 py-2 text-xs font-bold text-white hover:bg-[#DC2626] transition-colors"
        >
          Go to Sign In →
        </Link>
      </div>
    </div>
  );
}
