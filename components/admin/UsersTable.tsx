"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
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
  "bg-[#DC2626] text-white",
  "bg-[#78350F] text-white",
];

export default function UsersTable({ initialUsers }: { initialUsers: SafeUser[] }) {
  const toast = useToast();
  const [users, setUsers] = useState<SafeUser[]>(initialUsers);
  const [tab, setTab] = useState<"all" | "active" | "pending" | "suspended" | "rejected">("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [busyId, setBusyId] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

  // Add Contributor Modal State
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newUser, setNewUser] = useState({
    displayName: "",
    email: "",
    password: "",
    bio: "",
    role: "contributor" as "contributor" | "admin",
    status: "approved" as "approved" | "pending",
  });

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

  // Paginated slice
  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  // Adjust page if out of bounds
  if (currentPage > totalPages && totalPages > 0) {
    setCurrentPage(totalPages);
  }

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
    }
  }

  async function handleAddContributor(e: React.FormEvent) {
    e.preventDefault();
    if (!newUser.displayName.trim() || !newUser.email.trim()) {
      toast.error("Please enter a name and email.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create contributor.");
      setUsers((prev) => [data.user, ...prev]);
      toast.success("Contributor added successfully!");
      setAddModalOpen(false);
      setNewUser({
        displayName: "",
        email: "",
        password: "",
        bio: "",
        role: "contributor",
        status: "approved",
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error creating contributor.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="font-sans space-y-6 pb-20 text-slate-800 antialiased">
      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Contributors &amp; Users
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Manage all contributors, writers, and user accounts.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Search Input */}
          <div className="relative min-w-[240px] sm:min-w-[280px]">
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by name or email..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-3.5 pr-8 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#DC2626] focus:outline-none transition-all shadow-2xs"
            />
            <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
          </div>

          {/* Filter / Sort Button */}
          <div className="relative">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs focus:border-[#DC2626] focus:outline-none cursor-pointer appearance-none pr-8 pl-8"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="name-asc">Name A–Z</option>
              <option value="name-desc">Name Z–A</option>
            </select>
            <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400 text-xs">
              <svg className="h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
            </span>
            <span className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none text-slate-400 text-[10px]">
              ▼
            </span>
          </div>

          {/* Add Contributor Button */}
          <button
            type="button"
            onClick={() => setAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#DC2626] px-4 py-2 text-xs font-bold text-white shadow-2xs hover:bg-[#B91C1C] transition-all cursor-pointer"
          >
            <span className="text-sm font-extrabold">+</span>
            <span>Add Contributor</span>
          </button>
        </div>
      </div>

      {/* 5 KPI Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Total Users */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shrink-0">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <p className="text-2xl font-extrabold text-slate-900">{counts.total}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-700">Total Users</p>
            <p className="text-[10px] font-semibold text-emerald-600 mt-0.5">↑ 2 this month</p>
          </div>
        </div>

        {/* Active Writers */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 shrink-0">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </div>
            <p className="text-2xl font-extrabold text-slate-900">{counts.active}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-700">Active Writers</p>
            <p className="text-[10px] font-semibold text-emerald-600 mt-0.5">↑ 2 this month</p>
          </div>
        </div>

        {/* Pending Applications */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 shrink-0">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-2xl font-extrabold text-slate-900">{counts.pending}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-700">Pending Applications</p>
            <p className="text-[10px] font-semibold text-slate-400 mt-0.5">No change</p>
          </div>
        </div>

        {/* Suspended */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600 shrink-0">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <p className="text-2xl font-extrabold text-slate-900">{counts.suspended}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-700">Suspended</p>
            <p className="text-[10px] font-semibold text-slate-400 mt-0.5">No change</p>
          </div>
        </div>

        {/* Rejected */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-2xs space-y-3 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-[#DC2626] shrink-0">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" />
              </svg>
            </div>
            <p className="text-2xl font-extrabold text-slate-900">{counts.rejected}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-700">Rejected</p>
            <p className="text-[10px] font-semibold text-slate-400 mt-0.5">No change</p>
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
              onClick={() => {
                setTab(t.key as any);
                setCurrentPage(1);
              }}
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

      {/* User Cards Grid */}
      {paginatedUsers.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/90 bg-white p-12 text-center shadow-2xs">
          <p className="text-sm font-semibold text-slate-700">
            {users.length === 0 ? "No users registered yet." : "No contributors match this filter or search."}
          </p>
          <p className="text-xs text-slate-400 mt-1">Try resetting your filter or search query.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {paginatedUsers.map((user, idx) => {
            const initials = user.displayName?.slice(0, 1).toUpperCase() || "U";
            const colorClass = AVATAR_COLORS[idx % AVATAR_COLORS.length];
            const lastLoginDt = formatDateTime(user.lastLoginAt);
            const joinedDt = formatDateTime(user.createdAt);
            const busy = busyId === user.id;

            return (
              <div
                key={user.id}
                className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3.5">
                  {/* Avatar + Name + Email */}
                  <div className="flex items-center gap-3">
                    {user.avatarUrl ? (
                      <div className="relative h-11 w-11 rounded-full overflow-hidden shrink-0 border border-slate-200">
                        <Image src={user.avatarUrl} alt={user.displayName} fill className="object-cover" />
                      </div>
                    ) : (
                      <div
                        className={`flex h-11 w-11 items-center justify-center rounded-full font-bold text-sm shrink-0 shadow-2xs ${colorClass}`}
                      >
                        {initials}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/admin/users/${user.id}`}
                        className="font-bold text-slate-900 text-sm line-clamp-1 hover:text-[#DC2626] transition-colors"
                      >
                        {user.displayName || "(No name set)"}
                      </Link>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">{user.email}</p>
                    </div>
                  </div>

                  {/* Role Badge + Status Dot */}
                  <div className="space-y-2 pt-1">
                    <div>
                      {user.role === "admin" ? (
                        <span className="inline-flex items-center rounded-md bg-purple-50 text-purple-700 px-2 py-0.5 text-[10px] font-bold">
                          Administrator
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-md bg-blue-50 text-blue-600 px-2 py-0.5 text-[10px] font-semibold">
                          Contributor
                        </span>
                      )}
                    </div>

                    {/* Status Dot */}
                    <div>
                      {user.status === "rejected" ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#DC2626]">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#DC2626]" />
                          Rejected
                        </span>
                      ) : user.status === "pending" ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                          Pending
                        </span>
                      ) : user.status === "suspended" ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
                          Suspended
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Active
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Joined & Last Login Dates */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                        <span>🗓</span>
                        <span>Joined</span>
                      </span>
                      <span className="font-semibold text-slate-800 text-[11px]">{joinedDt.date}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                        <span>🕒</span>
                        <span>Last Login</span>
                      </span>
                      <div className="text-right">
                        {user.lastLoginAt ? (
                          <>
                            <p className="font-semibold text-slate-800 text-[11px]">{lastLoginDt.date}</p>
                            <p className="text-[10px] text-slate-400">{lastLoginDt.time}</p>
                          </>
                        ) : (
                          <span className="text-[11px] text-slate-400">Never logged in</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Actions Row */}
                <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                  <Link
                    href={`/admin/users/${user.id}`}
                    className="flex-1 rounded-xl border border-slate-200 bg-white py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors text-center"
                  >
                    View Profile
                  </Link>

                  {/* Status specific action button */}
                  {user.status === "approved" && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleStatusChange(user.id, "suspended")}
                      className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-[#DC2626] hover:bg-rose-50 transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
                      title="Suspend user account"
                    >
                      <svg className="w-3.5 h-3.5 text-[#DC2626]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                      <span>Suspend</span>
                    </button>
                  )}

                  {user.status === "pending" && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleStatusChange(user.id, "approved")}
                        className="rounded-xl bg-emerald-600 px-2.5 py-2 text-xs font-bold text-white shadow-2xs hover:bg-emerald-700 transition-colors disabled:opacity-50 cursor-pointer"
                        title="Approve user"
                      >
                        Active
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleStatusChange(user.id, "suspended")}
                        className="rounded-xl border border-purple-200 bg-purple-50 px-2 py-2 text-xs font-semibold text-purple-700 hover:bg-purple-100 transition-colors disabled:opacity-50 cursor-pointer"
                        title="Suspend user"
                      >
                        Suspend
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleStatusChange(user.id, "rejected")}
                        className="rounded-xl border border-rose-200 bg-rose-50 px-2 py-2 text-xs font-semibold text-[#DC2626] hover:bg-rose-100 transition-colors disabled:opacity-50 cursor-pointer"
                        title="Reject application"
                      >
                        Reject
                      </button>
                    </div>
                  )}

                  {user.status === "suspended" && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleStatusChange(user.id, "approved")}
                      className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
                      title="Reactivate user"
                    >
                      <span>✓</span>
                      <span>Active</span>
                    </button>
                  )}

                  {user.status === "rejected" && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleStatusChange(user.id, "approved")}
                      className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
                      title="Approve user"
                    >
                      <span>✓</span>
                      <span>Active</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination & Footer Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-4 border-t border-slate-200">
        <p className="text-xs text-slate-500 font-medium">
          Showing <span className="font-bold text-slate-800">{filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}</span> to{" "}
          <span className="font-bold text-slate-800">{Math.min(currentPage * pageSize, filtered.length)}</span> of{" "}
          <span className="font-bold text-slate-800">{filtered.length}</span> users
        </p>

        {/* Pagination Buttons */}
        {totalPages > 1 && (
          <div className="flex items-center gap-1.5 self-center">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              &lt;
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                type="button"
                onClick={() => setCurrentPage(page)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                  currentPage === page
                    ? "bg-[#DC2626] text-white shadow-2xs"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {page}
              </button>
            ))}
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              &gt;
            </button>
          </div>
        )}

        {/* Rows Per Page */}
        <div className="flex items-center gap-2 self-end sm:self-auto text-xs text-slate-500">
          <span>Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-2xs focus:border-[#DC2626] focus:outline-none cursor-pointer"
          >
            <option value={8}>8</option>
            <option value={12}>12</option>
            <option value={16}>16</option>
            <option value={24}>24</option>
            <option value={48}>48</option>
          </select>
        </div>
      </div>

      {/* Add Contributor Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-5 animate-fade-in-up">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Add New Contributor</h3>
                <p className="text-xs text-slate-500">Create or invite a new writer account.</p>
              </div>
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddContributor} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1">
                  Full Name <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newUser.displayName}
                  onChange={(e) => setNewUser({ ...newUser, displayName: e.target.value })}
                  placeholder="e.g. Marcus Vance"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-900 focus:border-[#DC2626] focus:outline-none shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1">
                  Email Address <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  placeholder="writer@worldattractionnews.com"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-900 focus:border-[#DC2626] focus:outline-none shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1">
                  Temporary Password (optional)
                </label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  placeholder="Leave blank to auto-generate password"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 focus:border-[#DC2626] focus:outline-none shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1">Bio / Beat</label>
                <textarea
                  rows={2}
                  value={newUser.bio}
                  onChange={(e) => setNewUser({ ...newUser, bio: e.target.value })}
                  placeholder="e.g. Travel correspondent covering theme parks and entertainment."
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 focus:border-[#DC2626] focus:outline-none shadow-2xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-900 mb-1">Role</label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value as any })}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-[#DC2626] focus:outline-none shadow-2xs"
                  >
                    <option value="contributor">Contributor</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-900 mb-1">Status</label>
                  <select
                    value={newUser.status}
                    onChange={(e) => setNewUser({ ...newUser, status: e.target.value as any })}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-[#DC2626] focus:outline-none shadow-2xs"
                  >
                    <option value="approved">Active (Approved)</option>
                    <option value="pending">Pending Review</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-xl bg-[#DC2626] px-5 py-2 text-xs font-bold text-white shadow-2xs hover:bg-[#B91C1C] transition-all disabled:opacity-50"
                >
                  {creating ? "Creating..." : "Save Contributor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
