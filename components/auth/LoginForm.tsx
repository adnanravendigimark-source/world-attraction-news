"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import GoogleButton from "./GoogleButton";
import Turnstile from "@/components/Turnstile";

const TURNSTILE_ENABLED = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

const GOOGLE_ERROR_MESSAGES: Record<string, string> = {
  google_not_configured: "Google Sign-In isn't configured on this site yet. Use email and password instead.",
  google_denied: "Google sign-in was cancelled.",
  google_state_mismatch: "Your Google sign-in attempt expired. Please try again.",
  google_email_unverified: "Your Google account's email isn't verified, so we can't use it to sign in.",
  google_failed: "Google sign-in failed. Please try again or use email and password.",
  account_rejected: "Your account registration was not approved. Contact us if you think this is a mistake.",
  account_suspended: "Your account has been suspended. Contact us if you think this is a mistake.",
};

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [error, setError] = useState(GOOGLE_ERROR_MESSAGES[searchParams.get("error") || ""] || "");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, turnstileToken }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invalid email or password.");
      router.push(searchParams.get("next") || "/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      {error && <p className="rounded border border-signal-border bg-signal-light p-2.5 text-xs text-signal-dark">{error}</p>}

      <GoogleButton label="Continue with Google" />

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-ink-200" />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">or</span>
        <span className="h-px flex-1 bg-ink-200" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1.5 w-full rounded-md border border-ink-300 px-3 py-2 text-sm focus:border-signal focus:outline-none"
          />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Password</label>
            <Link href="/forgot-password" className="text-[11px] font-semibold text-signal hover:underline">
              Forgot password?
            </Link>
          </div>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1.5 w-full rounded-md border border-ink-300 px-3 py-2 text-sm focus:border-signal focus:outline-none"
          />
        </div>
        {TURNSTILE_ENABLED && (
          <Turnstile onVerify={setTurnstileToken} onExpire={() => setTurnstileToken("")} />
        )}

        <button
          type="submit"
          disabled={submitting || (TURNSTILE_ENABLED && !turnstileToken)}
          className="w-full rounded-md bg-signal py-2.5 text-sm font-semibold text-white hover:bg-signal-dark disabled:opacity-60"
        >
          {submitting ? "Logging in..." : "Log In"}
        </button>
      </form>

      <p className="text-center text-xs text-ink-500">
        Don't have an account?{" "}
        <Link href="/signup" className="font-semibold text-signal hover:underline">
          Apply here
        </Link>
      </p>
    </div>
  );
}
