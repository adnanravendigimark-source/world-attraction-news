"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { SafeUser } from "@/lib/users";
import StatusBadge from "@/components/StatusBadge";
import { useConfirm } from "@/components/ConfirmProvider";
import { useToast } from "@/components/ToastProvider";

function formatDate(iso: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Which actions are valid from a given status — the single source of truth
// so the UI can never show an action that doesn't make sense for the
// user's current (database-persisted) state. "Approved" never gets an
// Approve button again; "rejected"/"suspended" get an Approve button to
// reverse the decision. An already-approved user only ever gets Suspend —
// Reject is reserved for a registration that was never approved in the
// first place, not for taking access away from an active contributor.
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
    <div className="rounded-lg border border-ink-200 bg-white p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <Link href={`/admin/users/${user.id}`} className="text-sm font-bold text-ink-900 hover:text-signal hover:underline">
            {user.displayName || "(no name)"}
          </Link>
          <p className="text-xs text-ink-500">{user.email}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-ink-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-ink-700">
            {user.role}
          </span>
          <StatusBadge status={user.status} />
        </div>
      </div>

      {user.bio && <p className="mt-2 text-xs text-ink-600">{user.bio}</p>}
      <p className="mt-1 text-[11px] text-ink-400">
        Applied {formatDate(user.createdAt)}
        {user.lastLoginAt ? ` · Last login ${formatDate(user.lastLoginAt)}` : " · Never logged in"}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
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
        <Link
          href={`/admin/users/${user.id}`}
          className="rounded-md border border-ink-300 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-ink-50"
        >
          View Details
        </Link>
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
  const [filter, setFilter] = useState<string>(statusFilter || "all");
  const [query, setQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");

  async function handleUpdate(id: string, updates: any) {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Something went wrong.");
    setUsers((prev) => prev.map((u) => (u.id === id ? data.user : u)));
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Couldn't delete this user.");
    }
    setUsers((prev) => prev.filter((u) => u.id !== id));
  }

  const filtered = useMemo(() => {
    let list = filter === "all" ? users : users.filter((u) => u.status === filter);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((u) => u.displayName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    }
    if (dateFrom) {
      const from = new Date(dateFrom).getTime();
      list = list.filter((u) => new Date(u.createdAt).getTime() >= from);
    }
    return list;
  }, [users, filter, query, dateFrom]);

  const pendingCount = users.filter((u) => u.status === "pending").length;

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {(["all", "pending", "approved", "rejected", "suspended"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                filter === f ? "border-ink-900 bg-ink-900 text-white" : "border-ink-200 bg-white text-ink-600 hover:border-ink-400"
              }`}
            >
              {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
              {f === "pending" && pendingCount > 0 ? ` (${pendingCount})` : ""}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or email..."
            className="w-56 rounded-md border border-ink-300 px-3 py-1.5 text-xs focus:border-signal focus:outline-none"
          />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            title="Joined on or after"
            className="rounded-md border border-ink-300 px-3 py-1.5 text-xs focus:border-signal focus:outline-none"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-6 text-sm text-ink-500">No users match this filter.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {filtered.map((u) => (
            <UserRow key={u.id} user={u} onUpdate={handleUpdate} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
