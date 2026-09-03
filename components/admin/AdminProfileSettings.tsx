"use client";

import { useState } from "react";
import { useToast } from "@/components/ToastProvider";

export default function AdminProfileSettings({
  email,
  isOwnerAccount,
  hasPassword,
}: {
  email: string;
  isOwnerAccount: boolean;
  hasPassword: boolean;
}) {
  const toast = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New password and confirmation don't match.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      toast.success("Password updated.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Signed in as</p>
        <p className="mt-1 text-sm text-ink-800">{email}</p>
      </div>

      {isOwnerAccount && (
        <p className="rounded border border-ink-200 bg-ink-50 p-3 text-xs text-ink-600">
          This is the owner account, first set up via{" "}
          <code className="rounded bg-ink-200 px-1 py-0.5">ADMIN_EMAIL</code> /{" "}
          <code className="rounded bg-ink-200 px-1 py-0.5">ADMIN_PASSWORD</code> in your environment variables.
          Changing it below overrides that — you won't need to touch the environment variables or redeploy again.
        </p>
      )}
      <form onSubmit={handleSubmit} className="space-y-3">
        <h3 className="text-sm font-bold text-ink-900">Change Password</h3>
        {hasPassword && (
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="mt-1.5 w-full max-w-sm rounded-md border border-ink-300 px-3 py-2 text-sm"
            />
          </div>
        )}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">New Password</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="mt-1.5 w-full max-w-sm rounded-md border border-ink-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Confirm New Password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="mt-1.5 w-full max-w-sm rounded-md border border-ink-300 px-3 py-2 text-sm"
          />
        </div>
        <button
          disabled={busy}
          type="submit"
          className="rounded-md bg-signal px-4 py-2 text-sm font-semibold text-white hover:bg-signal-dark disabled:opacity-60"
        >
          {busy ? "Saving..." : "Update Password"}
        </button>
      </form>
    </div>
  );
}
