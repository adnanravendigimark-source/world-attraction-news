"use client";

import { useState } from "react";
import Link from "next/link";
import GoogleButton from "./GoogleButton";
import { getRecaptchaToken } from "@/lib/recaptchaClient";

export default function SignupForm() {
  const [form, setForm] = useState({ displayName: "", email: "", password: "", bio: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      // reCAPTCHA v3 is invisible — no widget to wait on, just fetch a
      // fresh token right before submitting. null (script blocked/timed
      // out) is fine; the server fails open on a missing token too.
      const recaptchaToken = await getRecaptchaToken("signup");
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, recaptchaToken }),
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
      <div className="text-center">
        <p className="text-2xl">✅</p>
        <h2 className="mt-2 text-base font-bold text-ink-900">Check your email</h2>
        <p className="mt-2 text-sm text-ink-600">
          We sent a verification link to <strong>{form.email}</strong>. Click it to confirm your address — your
          application goes to our editorial team for approval right after.
        </p>
        <Link href="/login" className="mt-4 inline-block text-sm font-semibold text-signal hover:underline">
          Go to Log In →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {error && <p className="rounded border border-signal-border bg-signal-light p-2.5 text-xs text-signal-dark">{error}</p>}

      <GoogleButton label="Sign up with Google" />

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-ink-200" />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">or</span>
        <span className="h-px flex-1 bg-ink-200" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Your Name</label>
          <input
            required
            value={form.displayName}
            onChange={(e) => setForm({ ...form, displayName: e.target.value })}
            className="mt-1.5 w-full rounded-md border border-ink-300 px-3 py-2 text-sm focus:border-signal focus:outline-none"
          />
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Email</label>
          <input
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="mt-1.5 w-full rounded-md border border-ink-300 px-3 py-2 text-sm focus:border-signal focus:outline-none"
          />
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Password</label>
          <input
            type="password"
            required
            minLength={8}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="mt-1.5 w-full rounded-md border border-ink-300 px-3 py-2 text-sm focus:border-signal focus:outline-none"
          />
          <p className="mt-1 text-[11px] text-ink-400">At least 8 characters.</p>
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Short Bio (optional)</label>
          <textarea
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            rows={3}
            className="mt-1.5 w-full rounded-md border border-ink-300 px-3 py-2 text-sm focus:border-signal focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-signal py-2.5 text-sm font-semibold text-white hover:bg-signal-dark disabled:opacity-60"
        >
          {submitting ? "Submitting..." : "Submit Application"}
        </button>
        <p className="text-center text-[10px] text-ink-400">
          This site is protected by reCAPTCHA and the Google{" "}
          <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="underline">
            Privacy Policy
          </a>{" "}
          and{" "}
          <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" className="underline">
            Terms of Service
          </a>{" "}
          apply.
        </p>
      </form>

      <p className="text-center text-xs text-ink-500">
        Already approved?{" "}
        <Link href="/login" className="font-semibold text-signal hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
