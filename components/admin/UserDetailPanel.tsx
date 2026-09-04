"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SafeUser } from "@/lib/users";
import { useConfirm } from "@/components/ConfirmProvider";
import { useToast } from "@/components/ToastProvider";

export default function UserDetailPanel({ user: initialUser }: { user: SafeUser }) {
  const router = useRouter();
  const [user, setUser] = useState(initialUser);
  const [busy, setBusy] = useState(false);
  const confirm = useConfirm();
  const toast = useToast();

  async function run(updates: any, successMessage: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setUser(data.user);
      toast.success(successMessage);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function handleStatusChange(status: string, label: string) {
    const ok = await confirm({
      title: `${label} this user?`,
      description:
        status === "approved"
          ? "They will receive contributor access and can submit dispatches immediately."
          : status === "suspended"
          ? "Their account will be temporarily blocked from logging in."
          : "They will not be granted access to the contributor workspace.",
      confirmLabel: label,
      danger: status === "rejected" || status === "suspended",
    });
    if (!ok) return;

    await run({ status }, `User marked as ${status}.`);
  }

  async function handleDelete() {
    const ok = await confirm({
      title: "Permanently delete this user?",
      description: "Their profile will be deleted. Any articles they wrote will remain intact.",
      confirmLabel: "Delete User",
      danger: true,
    });
    if (!ok) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Couldn't delete user.");
      }
      toast.success("User deleted.");
      router.push("/admin/users");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete user.");
      setBusy(false);
    }
  }

  return (
    <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
      {/* Role — read-only. Every account is created as "contributor" at
          signup (password or Google); "admin" is only ever granted via the
          env-driven owner account or a direct database change, never from
          this page — there's no role-change control here by design. */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold uppercase text-slate-700">Role:</span>
        <span
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
            user.role === "admin" ? "bg-purple-50 text-purple-700 border border-purple-200" : "bg-blue-50 text-blue-700 border border-blue-200"
          }`}
        >
          {user.role === "admin" ? "Administrator" : "Contributor"}
        </span>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        {user.status === "pending" && user.emailVerified && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => handleStatusChange("approved", "Approve")}
              className="rounded-lg bg-emerald-700 px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-emerald-800 disabled:opacity-50 cursor-pointer"
            >
              ✓ Approve / Active
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => handleStatusChange("suspended", "Suspend")}
              className="rounded-lg border border-purple-300 bg-purple-50 px-3.5 py-1.5 text-xs font-semibold text-purple-900 hover:bg-purple-100 disabled:opacity-50 cursor-pointer"
            >
              Suspend
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => handleStatusChange("rejected", "Reject")}
              className="rounded-lg border border-rose-300 bg-rose-50 px-3.5 py-1.5 text-xs font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-50 cursor-pointer"
            >
              ✕ Reject Application
            </button>
          </>
        )}

        {user.status === "approved" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => handleStatusChange("suspended", "Suspend Access")}
            className="rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50 cursor-pointer"
          >
            Suspend Access
          </button>
        )}

        {user.status === "suspended" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => handleStatusChange("approved", "Reactivate Account")}
            className="rounded-lg bg-emerald-700 px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-emerald-800 disabled:opacity-50 cursor-pointer"
          >
            Reactivate Account
          </button>
        )}

        {user.status === "rejected" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => handleStatusChange("approved", "Approve")}
            className="rounded-lg bg-emerald-700 px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-emerald-800 disabled:opacity-50 cursor-pointer"
          >
            Approve Contributor
          </button>
        )}

        <button
          type="button"
          disabled={busy}
          onClick={handleDelete}
          className="rounded-lg border border-slate-200 px-3.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50 cursor-pointer"
        >
          Delete User
        </button>
      </div>
    </div>
  );
}
