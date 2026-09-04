"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { SafeUser } from "@/lib/users";
import { useToast } from "@/components/ToastProvider";

type SortKey = "newest" | "oldest" | "name-asc" | "name-desc";

function formatDateTime(iso: string | null) {
  if (!iso) return { date: "—", time: "" };
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  return { date, time };
}

const AVATAR_COLORS = [
  "bg-slate-900 text-white",
  "bg-blue-600 text-white",
  "bg-emerald-600 text-white",
  "bg-amber-600 text-white",
  "bg-purple-600 text-white",
  "bg-teal-600 text-white",
  "bg-rose-600 text-white",
];

// Every account reaching this table came from /signup, Google sign-in, or
// the env-driven admin owner — role is fixed at creation time (see
// lib/users.ts's registerContributor/findOrCreateGoogleUser, both of which
// hardcode 'contributor'). There is no "editor" role in the type system
// (UserRole = "admin" | "contributor") and this page deliberately doesn't
// offer a way to change a user's role — see the PATCH route, which no
// longer accepts a role field at all.
export default function UsersTable({ initialUsers }: { initialUsers: SafeUser[] }) {
  const toast = useToast();
  const [users, setUsers] = useState<SafeUser[]>(initialUsers);
  const [tab, setTab] = useState<"all" | "active" | "pending" | "suspended" | "rejected">("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);

  const counts = useMemo(() => {
    return {
      total: users.length,
      active: users.filter((u) => u.status === "approved").length,
      pending: users.filter((u) => u.status === "pending").length,
      suspended: users.filter((u) => u.status === "suspended").length,
      rejected: users.filter((u) => u.status === "rejected").length,
    };
  }, [users]);

  const filtered = useMemo(() => {
    let list = users;

    if (tab === "active") {
      list = list.filter((u) => u.status === "approved");
    } else if (tab === "pending") {
      list = list.filter((u) => u.status === "pending");
    } else if (tab === "suspended") {
      list = list.filter((u) => u.status === "suspended");
    } else if (tab === "rejected") {
      list = list.filter((u) => u.status === "rejected");
    }

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (u) => u.displayName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
      );
    }

    const sorted = [...list];
    sorted.sort((a, b) => {
      switch (sort) {
        case "oldest":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "name-asc":
          return a.displayName.localeCompare(b.displayName);
        case "name-desc":
          return b.displayName.localeCompare(a.displayName);
        case "newest":
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });
    return sorted;
  }, [users, tab, query, sort]);

  async function handleStatusChange(userId: string, newStatus: string) {
    setBusyId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed.");
      setUsers((prev) => prev.map((u) => (u.id === userId ? data.user : u)));
      toast.success(`User status set to ${newStatus}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update user.");
    } finally {
      setBusyId(null);
      setActionMenuId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Contributors &amp; Users
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Every account here signed up itself — contributors via /signup or Google, no accounts are created from
            this page.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative min-w-[240px] sm:min-w-[280px]">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search users by name or email..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-3.5 pr-8 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#DC2626] focus:outline-none transition-all shadow-2xs"
            />
            <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
          </div>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs focus:border-[#DC2626] focus:outline-none cursor-pointer"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="name-asc">Name A–Z</option>
            <option value="name-desc">Name Z–A</option>
          </select>
        </div>
      </div>

      {/* KPI Stat Cards — real counts only, no fabricated minimums or trend deltas */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs flex items-center gap-3.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shrink-0">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div>
            <p className="text-xl font-extrabold text-slate-900 leading-tight">{counts.total}</p>
            <p className="text-[11px] text-slate-500 font-medium">Total Users</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs flex items-center gap-3.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 shrink-0">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </div>
          <div>
            <p className="text-xl font-extrabold text-slate-900 leading-tight">{counts.active}</p>
            <p className="text-[11px] text-slate-500 font-medium">Active Writers</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs flex items-center gap-3.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 shrink-0">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-xl font-extrabold text-slate-900 leading-tight">{counts.pending}</p>
            <p className="text-[11px] text-slate-500 font-medium">Pending Applications</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs flex items-center gap-3.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600 shrink-0">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div>
            <p className="text-xl font-extrabold text-slate-900 leading-tight">{counts.suspended}</p>
            <p className="text-[11px] text-slate-500 font-medium">Suspended</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs flex items-center gap-3.5 col-span-2 sm:col-span-1">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-[#DC2626] shrink-0">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" />
            </svg>
          </div>
          <div>
            <p className="text-xl font-extrabold text-slate-900 leading-tight">{counts.rejected}</p>
            <p className="text-[11px] text-slate-500 font-medium">Rejected</p>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-6 border-b border-slate-200 text-xs font-semibold overflow-x-auto no-scrollbar">
        {[
          { key: "all", label: `All Users (${counts.total})` },
          { key: "active", label: `Active Writers (${counts.active})` },
          { key: "pending", label: `Pending Applications (${counts.pending})` },
          { key: "suspended", label: `Suspended (${counts.suspended})` },
          { key: "rejected", label: `Rejected (${counts.rejected})` },
        ].map((t) => {
          const isActive = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key as any)}
              className={`pb-3 whitespace-nowrap transition-colors relative cursor-pointer ${
                isActive ? "text-[#DC2626] font-bold" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <span>{t.label}</span>
              {isActive && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#DC2626] rounded-full" />}
            </button>
          );
        })}
      </div>

      {/* Users Table */}
      <div className="rounded-2xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50/75 border-b border-slate-200/80 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="py-3.5 px-5 min-w-[260px]">User</th>
                <th className="py-3.5 px-4">Role</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 min-w-[110px]">Joined</th>
                <th className="py-3.5 px-4 min-w-[120px]">Last Login</th>
                <th className="py-3.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    {users.length === 0 ? "No users have signed up yet." : "No contributors match this search/filter."}
                  </td>
                </tr>
              ) : (
                filtered.map((user, idx) => {
                  const initials = user.displayName?.slice(0, 1).toUpperCase() || "U";
                  const colorClass = AVATAR_COLORS[idx % AVATAR_COLORS.length];
                  const lastLoginDt = formatDateTime(user.lastLoginAt);
                  const joinedDt = formatDateTime(user.createdAt);
                  const busy = busyId === user.id;

                  return (
                    <tr key={user.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-5">
                        <Link href={`/admin/users/${user.id}`} className="flex items-center gap-3 group">
                          <div
                            className={`flex h-9 w-9 items-center justify-center rounded-full font-bold text-xs shrink-0 ${colorClass}`}
                          >
                            {initials}
                          </div>
                          <div className="space-y-0.5 min-w-0">
                            <p className="font-bold text-slate-900 text-xs sm:text-sm line-clamp-1 group-hover:text-[#DC2626] transition-colors">
                              {user.displayName || "(No name set)"}
                            </p>
                            <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
                          </div>
                        </Link>
                      </td>

                      <td className="py-3.5 px-4">
                        {user.role === "admin" ? (
                          <span className="inline-flex items-center rounded-md bg-purple-50 border border-purple-200 px-2 py-0.5 text-[11px] font-bold text-purple-700">
                            Administrator
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-md bg-blue-50 border border-blue-200 px-2 py-0.5 text-[11px] font-bold text-blue-700">
                            Contributor
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        {user.status === "rejected" ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 border border-rose-200 px-2.5 py-0.5 text-[11px] font-bold text-[#DC2626]">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#DC2626]" />
                            Rejected
                          </span>
                        ) : user.status === "pending" ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[11px] font-bold text-amber-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            Pending
                          </span>
                        ) : user.status === "suspended" ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 border border-purple-200 px-2.5 py-0.5 text-[11px] font-bold text-purple-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
                            Suspended
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Active
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-[11px] text-slate-500 font-medium">{joinedDt.date}</td>

                      <td className="py-3.5 px-4">
                        {user.lastLoginAt ? (
                          <div className="text-[11px] leading-tight">
                            <p className="font-semibold text-slate-700">{lastLoginDt.date}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">{lastLoginDt.time}</p>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400">Never logged in</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          {user.status === "pending" && (
                            <>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => handleStatusChange(user.id, "approved")}
                                className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-2xs hover:bg-emerald-700 transition-colors disabled:opacity-50 cursor-pointer"
                                title="Approve and activate user"
                              >
                                Active
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => handleStatusChange(user.id, "suspended")}
                                className="rounded-lg border border-purple-200 bg-purple-50 px-2.5 py-1 text-[11px] font-semibold text-purple-700 hover:bg-purple-100 transition-colors disabled:opacity-50 cursor-pointer"
                                title="Suspend user"
                              >
                                Suspend
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => handleStatusChange(user.id, "rejected")}
                                className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-[#DC2626] hover:bg-rose-100 transition-colors disabled:opacity-50 cursor-pointer"
                                title="Reject application"
                              >
                                Reject
                              </button>
                            </>
                          )}

                          {user.status === "approved" && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleStatusChange(user.id, "suspended")}
                              className="rounded-lg border border-purple-200 bg-purple-50 px-3 py-1 text-[11px] font-semibold text-purple-700 hover:bg-purple-100 transition-colors disabled:opacity-50 cursor-pointer"
                              title="Suspend user account"
                            >
                              Suspend
                            </button>
                          )}

                          {user.status === "suspended" && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleStatusChange(user.id, "approved")}
                              className="rounded-lg bg-emerald-600 px-3 py-1 text-[11px] font-bold text-white shadow-2xs hover:bg-emerald-700 transition-colors disabled:opacity-50 cursor-pointer"
                              title="Reactivate user account"
                            >
                              Active
                            </button>
                          )}

                          {user.status === "rejected" && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleStatusChange(user.id, "approved")}
                              className="rounded-lg bg-emerald-600 px-3 py-1 text-[11px] font-bold text-white shadow-2xs hover:bg-emerald-700 transition-colors disabled:opacity-50 cursor-pointer"
                              title="Approve / Set Active"
                            >
                              Active
                            </button>
                          )}

                          <Link
                            href={`/admin/users/${user.id}`}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                          >
                            View
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-white px-5 py-3.5 text-xs text-slate-500">
          <p>
            Showing {filtered.length} of {users.length} user{users.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>
    </div>
  );
}
