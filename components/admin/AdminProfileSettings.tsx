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
    <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-2xs space-y-4">
      <div className="border-b border-slate-100 pb-3">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#DC2626]">ACCOUNT</span>
        <h3 className="text-sm font-bold text-slate-900 mt-0.5">Admin Profile</h3>
        <p className="mt-1 text-xs text-slate-500">Signed in as {email}</p>
      </div>

      {isOwnerAccount && (
        <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-600 leading-relaxed">
          This is the owner account, first set up via <code className="rounded bg-slate-200 px-1 py-0.5">ADMIN_EMAIL</code>{" "}
          / <code className="rounded bg-slate-200 px-1 py-0.5">ADMIN_PASSWORD</code> in your environment variables.
          Changing it below overrides that — you won't need to touch the environment variables or redeploy again.
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <h4 className="text-xs font-bold text-slate-800">Change Password</h4>
        {hasPassword && (
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
              Current Password
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full max-w-sm rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-[#DC2626] focus:outline-none"
            />
          </div>
        )}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
            New Password
          </label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full max-w-sm rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-[#DC2626] focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
            Confirm New Password
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full max-w-sm rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-[#DC2626] focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-[#DC2626] px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-2xs hover:bg-[#B91C1C] transition-all disabled:opacity-60 cursor-pointer"
        >
          {busy ? "Saving..." : "Update Password"}
        </button>
      </form>
    </div>
  );
}
