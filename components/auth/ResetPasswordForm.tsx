"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams?.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 space-y-2">
        <p className="font-semibold">Missing Reset Token</p>
        <p>
          This password reset link is invalid or expired. Please request a new link from the{" "}
          <Link href="/forgot-password" className="font-bold text-[#DC2626] underline">
            Forgot Password
          </Link>{" "}
          page.
        </p>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords do not match.");

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setDone(true);
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
          ✓
        </div>
        <h2 className="text-base font-bold text-slate-900">Password Updated</h2>
        <p className="text-xs text-slate-600">
          Your password has been reset successfully. You can now sign in with your new credentials.
        </p>
        <div className="pt-2">
          <Link
            href="/login"
            className="inline-block rounded-xl bg-[#0B1527] px-4 py-2 text-xs font-bold text-white hover:bg-[#DC2626] transition-colors"
          >
            Sign In Now →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3.5">
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
          {error}
        </div>
      )}

      <div>
        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
          New Password
        </label>
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#DC2626] focus:bg-white focus:outline-none transition-all"
        />
      </div>

      <div>
        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
          Confirm New Password
        </label>
        <input
          type="password"
          required
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Re-enter new password"
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#DC2626] focus:bg-white focus:outline-none transition-all"
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-[#DC2626] py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-2xs hover:bg-[#B91C1C] transition-all disabled:opacity-60 cursor-pointer"
      >
        {submitting ? "Updating..." : "Update Password →"}
      </button>
    </form>
  );
}
