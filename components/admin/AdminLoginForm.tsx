"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Recaptcha from "@/components/Recaptcha";

const RECAPTCHA_ENABLED = Boolean(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY);

export default function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [recaptchaToken, setRecaptchaToken] = useState("");
  const [recaptchaFailed, setRecaptchaFailed] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/auth/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, recaptchaToken }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invalid email or password.");
      router.push(searchParams.get("next") || "/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
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
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Password</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1.5 w-full rounded-md border border-ink-300 px-3 py-2 text-sm focus:border-signal focus:outline-none"
        />
      </div>

      {RECAPTCHA_ENABLED && !recaptchaFailed && (
        <Recaptcha
          onVerify={setRecaptchaToken}
          onExpire={() => setRecaptchaToken("")}
          onError={() => setRecaptchaFailed(true)}
        />
      )}
      {recaptchaFailed && (
        <p className="rounded border border-ink-800 bg-ink-800/50 p-2.5 text-xs text-ink-300">
          Couldn't load our spam-verification widget, so we're skipping it this time — you can still log in.
        </p>
      )}

      <button
        type="submit"
        disabled={submitting || (RECAPTCHA_ENABLED && !recaptchaFailed && !recaptchaToken)}
        className="w-full rounded-md bg-ink-900 py-2.5 text-sm font-semibold text-white hover:bg-ink-800 disabled:opacity-60"
      >
        {submitting ? "Logging in..." : "Log In"}
      </button>
    </form>
  );
}
