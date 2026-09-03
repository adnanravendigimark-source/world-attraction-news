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
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-6 text-center space-y-3">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xl font-bold">
          📬
        </div>
        <h2 className="text-base font-bold text-slate-900">Check your inbox</h2>
        <p className="text-xs text-slate-600 leading-relaxed">
          If an account exists for <span className="font-bold text-slate-900">{email}</span>, we have sent a password reset link.
        </p>
        {devResetUrl && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-left text-xs text-amber-900">
            <p className="font-semibold">Dev simulation link:</p>
            <p className="mt-1 break-all">
              <Link href={devResetUrl.replace(/^https?:\/\/[^/]+/, "")} className="underline text-[#DC2626] font-mono">
                {devResetUrl}
              </Link>
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
          {error}
        </div>
      )}

      <div>
        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
          Registered Email Address
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@domain.com"
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#DC2626] focus:bg-white focus:outline-none transition-all"
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-[#DC2626] py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-2xs hover:bg-[#B91C1C] transition-all disabled:opacity-60 cursor-pointer"
      >
        {submitting ? "Sending..." : "Send Reset Link →"}
      </button>
    </form>
  );
}
