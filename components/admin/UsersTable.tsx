"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { SafeUser } from "@/lib/users";
import StatusBadge from "@/components/StatusBadge";
import { useConfirm } from "@/components/ConfirmProvider";
import { useToast } from "@/components/ToastProvider";

function formatDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function actionsFor(status: string, emailVerified: boolean): {
  label: string;
  nextStatus: string;
  className: string;
  confirmTitle: string;
  confirmDescription: string;
}[] {
  switch (status) {
    case "pending":
      // Not shown to admins as a reviewable application until the person
      // has clicked the verification link in their signup email (see
      // lib/users.ts's emailVerified column) — approving/rejecting an
      // unconfirmed email address isn't a real decision to make yet.
      if (!emailVerified) return [];
      return [
        {
          label: "Approve Writer",
          nextStatus: "approved",
          className: "bg-emerald-700 text-white hover:bg-emerald-800",
          confirmTitle: "Approve this correspondent?",
          confirmDescription: "They will be able to log in and submit articles immediately.",
        },
        {
          label: "Reject Application",
          nextStatus: "rejected",
          className: "border border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100",
          confirmTitle: "Reject this registration?",
          confirmDescription: "They will not receive access to the writer workspace.",
        },
      ];
    case "approved":
      return [
        {
          label: "Suspend Access",
          nextStatus: "suspended",
          className: "border border-orange-300 bg-orange-50 text-orange-900 hover:bg-orange-100",
          confirmTitle: "Suspend this contributor?",
          confirmDescription: "They will be temporarily blocked from logging in.",
        },
      ];
    case "rejected":
      return [
        {
          label: "Approve",
          nextStatus: "approved",
          className: "bg-emerald-700 text-white hover:bg-emerald-800",
          confirmTitle: "Approve this contributor?",
          confirmDescription: "They will be able to log in and submit articles.",
        },
      ];
    case "suspended":
      return [
        {
          label: "Reactivate",
          nextStatus: "approved",
          className: "bg-emerald-700 text-white hover:bg-emerald-800",
          confirmTitle: "Reactivate this account?",
          confirmDescription: "Access will be restored immediately.",
        },
        {
          label: "Reject",
          nextStatus: "rejected",
          className: "border border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100",
          confirmTitle: "Reject this user?",
          confirmDescription: "They will not be able to log in.",
        },
      ];
    default:
      return [];
  }
}

function UserRow({
  user,
  onUpdate,
  onDelete,
}: {
  user: SafeUser;
  onUpdate: (id: string, updates: any) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const confirm = useConfirm();
  const toast = useToast();

  async function run(updates: any, successMessage: string) {
    setBusy(true);
    try {
      await onUpdate(user.id, updates);
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
      danger: a.label.includes("Reject") || a.label.includes("Suspend"),
    });
    if (!ok) return;
    run({ status: a.nextStatus }, `${user.displayName || user.email}: ${a.label}.`);
  }

  async function handleDemote() {
    const ok = await confirm({
      title: "Demote to contributor?",
      description: "They will lose administrative access.",
      confirmLabel: "Demote",
      danger: true,
    });
    if (!ok) return;
    run({ role: "contributor" }, `${user.displayName || user.email} demoted.`);
  }

  async function handleDelete() {
    const ok = await confirm({
      title: `Delete ${user.email}?`,
      description: "This permanently removes the account.",
      confirmLabel: "Delete User",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await onDelete(user.id);
      toast.success(`${user.email} deleted.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete this user.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-ink-200/80 bg-white p-5 shadow-card space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href={`/admin/users/${user.id}`}
            className="font-serif text-base font-bold text-ink-950 hover:text-signal transition-colors"
          >
            {user.displayName || "(Unnamed Contributor)"}
          </Link>
          <p className="font-mono text-xs text-ink-500">{user.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-paper-200 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-ink-700">
            {user.role}
          </span>
          <StatusBadge status={user.status} />
        </div>
      </div>

      {user.status === "pending" && !user.emailVerified && (
        <p className="rounded-lg border border-dashed border-ink-300 bg-paper-50 px-3 py-2 text-xs text-ink-500">
          Awaiting email verification — this application won't be reviewable until they confirm their email address.
        </p>
      )}

      {user.bio && (
        <p className="text-xs text-ink-700 bg-paper-50 p-3 rounded-lg border border-ink-100 leading-relaxed">
          {user.bio}
        </p>
      )}

      <p className="font-mono text-[11px] text-ink-400">
        Applied {formatDate(user.createdAt)}
        {user.lastLoginAt ? ` · Active ${formatDate(user.lastLoginAt)}` : " · No login recorded"}
      </p>

      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-ink-100">
        {actionsFor(user.status, user.emailVerified).map((a) => (
          <button
            key={a.label}
            disabled={busy}
            onClick={() => handleAction(a)}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all disabled:opacity-50 ${a.className}`}
          >
            {a.label}
          </button>
        ))}
        <Link
          href={`/admin/users/${user.id}`}
          className="rounded-lg border border-ink-300 bg-paper-50 px-3 py-1.5 text-xs font-bold text-ink-700 hover:bg-paper-100 transition-all"
        >
          View Profile &amp; History
        </Link>
        {user.role !== "contributor" && (
          <button
            disabled={busy}
            onClick={handleDemote}
            className="rounded-lg border border-ink-300 px-3 py-1.5 text-xs font-bold text-ink-700 hover:bg-paper-100 disabled:opacity-50"
          >
            Demote
          </button>
        )}
        <button
          disabled={busy}
          onClick={handleDelete}
          className="ml-auto rounded-lg px-3 py-1.5 text-xs font-bold text-ink-400 hover:text-signal disabled:opacity-50"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

export default function UsersTable({ initialUsers }: { initialUsers: SafeUser[] }) {
  const [users, setUsers] = useState(initialUsers);
  const searchParams = useSearchParams();
  const statusFilter = searchParams.get("status");
  const [filter, setFilter] = useState(statusFilter || "all");
  const [query, setQuery] = useState("");

  const counts = {
    pending: users.filter((u) => u.status === "pending").length,
    approved: users.filter((u) => u.status === "approved").length,
    rejected: users.filter((u) => u.status === "rejected").length,
    suspended: users.filter((u) => u.status === "suspended").length,
  };

  const filtered = useMemo(() => {
    let list = filter === "all" ? users : users.filter((u) => u.status === filter);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (u) =>
          u.email.toLowerCase().includes(q) ||
          (u.displayName && u.displayName.toLowerCase().includes(q)) ||
          (u.bio && u.bio.toLowerCase().includes(q))
      );
    }
    return list;
  }, [users, filter, query]);

  async function handleUpdate(id: string, updates: any) {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to update user.");
    setUsers((prev) => prev.map((u) => (u.id === id ? data.user : u)));
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to delete user.");
    setUsers((prev) => prev.filter((u) => u.id !== id));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-ink-100 pb-4">
        <div>
          <h2 className="font-serif text-xl font-black text-ink-950">Correspondents &amp; Users ({users.length})</h2>
          <p className="mt-0.5 text-xs text-ink-500">Manage writer applications, authorizations, and editorial roles.</p>
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search writers by name, email..."
          className="w-full sm:w-64 rounded-xl border border-ink-200 bg-white px-3 py-1.5 text-xs focus:border-signal focus:outline-none"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {(["all", "pending", "approved", "rejected", "suspended"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-bold transition-all ${
              filter === s
                ? "border-ink-950 bg-ink-950 text-white shadow-card"
                : "border-ink-200 bg-white text-ink-700 hover:border-ink-400"
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
            {s !== "all" && counts[s] > 0 && <span className="ml-1.5 font-mono text-[10px]">({counts[s]})</span>}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-300 bg-white p-12 text-center text-xs text-ink-500">
          No users match this filter.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((user) => (
            <UserRow key={user.id} user={user} onUpdate={handleUpdate} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
