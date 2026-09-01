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
      toast.success("Password updated.");
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
    <form onSubmit={handleSubmit} className="space-y-4">
      {hasPassword ? (
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Current Password</label>
          <input
            type="password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="mt-1.5 w-full rounded-md border border-ink-300 px-3 py-2 text-sm focus:border-signal focus:outline-none"
          />
        </div>
      ) : (
        <p className="text-xs text-ink-500">
          Your account signed up with Google and has no password yet — set one below if you'd also like to log in
          with email and password.
        </p>
      )}

      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">
          {hasPassword ? "New Password" : "Set Password"}
        </label>
        <input
          type="password"
          required
          minLength={8}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="mt-1.5 w-full rounded-md border border-ink-300 px-3 py-2 text-sm focus:border-signal focus:outline-none"
        />
      </div>
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Confirm Password</label>
        <input
          type="password"
          required
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="mt-1.5 w-full rounded-md border border-ink-300 px-3 py-2 text-sm focus:border-signal focus:outline-none"
        />
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-signal px-4 py-2 text-sm font-semibold text-white hover:bg-signal-dark disabled:opacity-60"
      >
        {submitting ? "Saving..." : hasPassword ? "Update Password" : "Set Password"}
      </button>
    </form>
  );
}
