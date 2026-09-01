"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [devResetUrl, setDevResetUrl] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setDone(true);
      if (data.devResetUrl) setDevResetUrl(data.devResetUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="text-center">
        <p className="text-2xl">📬</p>
        <h2 className="mt-2 text-base font-bold text-ink-900">Check your email</h2>
        <p className="mt-2 text-sm text-ink-600">
          If an account exists for <span className="font-semibold">{email}</span>, we've sent a password reset link.
          It expires in 1 hour.
        </p>
        {devResetUrl && (
          <div className="mt-4 rounded border border-amber-200 bg-amber-50 p-3 text-left text-xs text-amber-900">
            <p className="font-semibold">Dev mode — no email provider configured.</p>
            <p className="mt-1 break-all">
              <Link href={devResetUrl.replace(/^https?:\/\/[^/]+/, "")} className="underline">
                {devResetUrl}
              </Link>
            </p>
          </div>
        )}
        <Link href="/login" className="mt-4 inline-block text-sm font-semibold text-signal hover:underline">
          ← Back to Log In
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="rounded border border-signal-border bg-signal-light p-2.5 text-xs text-signal-dark">{error}</p>}
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
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-signal py-2.5 text-sm font-semibold text-white hover:bg-signal-dark disabled:opacity-60"
      >
        {submitting ? "Sending..." : "Send Reset Link"}
      </button>
      <p className="text-center text-xs text-ink-500">
        <Link href="/login" className="font-semibold text-signal hover:underline">
          ← Back to Log In
        </Link>
      </p>
    </form>
  );
}
