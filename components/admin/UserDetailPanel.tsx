"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SafeUser } from "@/lib/users";
import StatusBadge from "@/components/StatusBadge";
import { useConfirm } from "@/components/ConfirmProvider";
import { useToast } from "@/components/ToastProvider";

// Same rules as components/admin/UsersTable.tsx — an already-approved user
// only ever gets Suspend (never Reject again); kept as a small local
// function here rather than a shared import since it's pure and trivial.
function actionsFor(status: string): {
  label: string;
  nextStatus: string;
  className: string;
  confirmTitle: string;
  confirmDescription: string;
}[] {
  switch (status) {
    case "pending":
      return [
        {
          label: "Approve",
          nextStatus: "approved",
          className: "bg-emerald-600 text-white hover:bg-emerald-700",
          confirmTitle: "Approve this user?",
          confirmDescription: "They'll be able to log in and submit articles immediately.",
        },
        {
          label: "Reject",
          nextStatus: "rejected",
          className: "border border-signal-border bg-signal-light text-signal-dark hover:bg-signal-border",
          confirmTitle: "Reject this registration?",
          confirmDescription: "They won't be able to log in until an admin approves them.",
        },
      ];
    case "approved":
      return [
        {
          label: "Suspend",
          nextStatus: "suspended",
          className: "border border-orange-300 bg-orange-50 text-orange-800 hover:bg-orange-100",
          confirmTitle: "Suspend this user?",
          confirmDescription: "They'll be blocked from logging in immediately, until reactivated.",
        },
      ];
    case "rejected":
      return [
        {
          label: "Approve",
          nextStatus: "approved",
          className: "bg-emerald-600 text-white hover:bg-emerald-700",
          confirmTitle: "Approve this user?",
          confirmDescription: "They'll be able to log in and submit articles immediately.",
        },
      ];
    case "suspended":
      return [
        {
          label: "Reactivate",
          nextStatus: "approved",
          className: "bg-emerald-600 text-white hover:bg-emerald-700",
          confirmTitle: "Reactivate this user?",
          confirmDescription: "They'll be able to log in again immediately.",
        },
        {
          label: "Reject",
          nextStatus: "rejected",
          className: "border border-signal-border bg-signal-light text-signal-dark hover:bg-signal-border",
          confirmTitle: "Reject this user?",
          confirmDescription: "They won't be able to log in until an admin approves them again.",
        },
      ];
    default:
      return [];
  }
}

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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function handleAction(a: ReturnType<typeof actionsFor>[number]) {
    const ok = await confirm({
      title: a.confirmTitle,
      description: a.confirmDescription,
      confirmLabel: a.label,
      danger: a.label === "Reject" || a.label === "Suspend",
    });
    if (!ok) return;
    run({ status: a.nextStatus }, `${user.displayName || user.email}: ${a.label.toLowerCase()}d.`);
  }

  async function handleDemote() {
    const ok = await confirm({
      title: "Demote to contributor?",
      description: "They'll lose admin access immediately.",
      confirmLabel: "Demote",
      danger: true,
    });
    if (!ok) return;
    run({ role: "contributor" }, `${user.displayName || user.email} demoted to contributor.`);
  }

  async function handleDelete() {
    const ok = await confirm({
      title: `Delete ${user.email}?`,
      description: "This permanently deletes the account and cannot be undone.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success(`${user.email} deleted.`);
      router.push("/admin/users");
      router.refresh();
    } else {
      setBusy(false);
      toast.error("Couldn't delete this user.");
    }
  }

  return (
    <div className="rounded-lg border border-ink-200 bg-white p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-ink-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-ink-700">{user.role}</span>
        <StatusBadge status={user.status} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {actionsFor(user.status).map((a) => (
          <button
            key={a.label}
            disabled={busy}
            onClick={() => handleAction(a)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${a.className}`}
          >
            {a.label}
          </button>
        ))}
        {user.role !== "contributor" && (
          <button
            disabled={busy}
            onClick={handleDemote}
            className="rounded-md border border-ink-300 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-ink-50 disabled:opacity-50"
          >
            Demote to Contributor
          </button>
        )}
        <button
          disabled={busy}
          onClick={handleDelete}
          className="ml-auto rounded-md px-3 py-1.5 text-xs font-semibold text-ink-400 hover:bg-ink-50 hover:text-signal disabled:opacity-50"
        >
          Delete Account
        </button>
      </div>
    </div>
  );
}
