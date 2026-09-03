"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthRecaptcha, useAuthRecaptcha } from "@/components/auth/AuthRecaptcha";

export default function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const recaptcha = useAuthRecaptcha();
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
        body: JSON.stringify({ email, password, recaptchaToken: recaptcha.recaptchaToken }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invalid administrator credentials.");
      router.push(searchParams?.get("next") || "/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-semibold text-rose-300">
          {error}
        </div>
      )}

      <div>
        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1.5">
          Admin Email
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@worldattractionnews.com"
          className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:border-[#DC2626] focus:bg-slate-800 focus:outline-none transition-all"
        />
      </div>

      <div>
        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1.5">
          Password
        </label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••••••"
          className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:border-[#DC2626] focus:bg-slate-800 focus:outline-none transition-all"
        />
      </div>

      <AuthRecaptcha state={recaptcha} theme="dark" />

      <button
        type="submit"
        disabled={submitting || recaptcha.blocked}
        className="w-full rounded-xl bg-[#DC2626] py-3 text-xs font-bold uppercase tracking-wider text-white shadow-lg hover:bg-[#B91C1C] transition-all disabled:opacity-60 cursor-pointer"
      >
        {submitting ? "Authenticating..." : "Sign In to Admin CMS →"}
      </button>
    </form>
  );
}
