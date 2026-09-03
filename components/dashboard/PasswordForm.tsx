"use client";

import { useState } from "react";
import { useToast } from "@/components/ToastProvider";

export default function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const toast = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) return toast.error("New password must be at least 8 characters.");
    if (newPassword !== confirm) return toast.error("Passwords don't match.");

    setSubmitting(true);
    try {
      const res = await fetch("/api/dashboard/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      toast.success("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      {hasPassword ? (
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
            Current Password *
          </label>
          <input
            type="password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#DC2626] focus:bg-white focus:outline-none transition-all"
          />
        </div>
      ) : (
        <p className="text-xs text-slate-500">
          Your account signed up with Google and has no password yet — set one below if you'd also like to log in
          with email and password.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
            {hasPassword ? "New Password *" : "Set Password *"}
          </label>
          <input
            type="password"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="At least 8 characters"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#DC2626] focus:bg-white focus:outline-none transition-all"
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
            Confirm Password *
          </label>
          <input
            type="password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Confirm new password"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#DC2626] focus:bg-white focus:outline-none transition-all"
          />
        </div>
      </div>

      <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-xl bg-[#DC2626] px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-2xs hover:bg-[#B91C1C] transition-all disabled:opacity-60 cursor-pointer"
        >
          {submitting ? "Updating..." : "Update Password"}
        </button>
      </div>
    </form>
  );
}
