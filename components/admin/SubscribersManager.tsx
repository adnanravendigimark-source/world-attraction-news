"use client";

import { useState, useMemo } from "react";
import type { Subscriber } from "@/lib/newsletter";
import { useToast } from "@/components/ToastProvider";
import { useConfirm } from "@/components/ConfirmProvider";

function formatDateTime(iso: string | null) {
  if (!iso) return { date: "—", time: "" };
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  return { date, time };
}

export default function SubscribersManager({
  initialSubscribers,
}: {
  initialSubscribers: Subscriber[];
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [subscribers, setSubscribers] = useState<Subscriber[]>(initialSubscribers);
  const [tab, setTab] = useState<"all" | "active" | "unsubscribed">("all");
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const counts = useMemo(() => {
    return {
      total: subscribers.length,
      active: subscribers.filter((s) => !s.unsubscribedAt).length,
      unsubscribed: subscribers.filter((s) => s.unsubscribedAt).length,
    };
  }, [subscribers]);

  const filtered = useMemo(() => {
    let list = subscribers;
    if (tab === "active") {
      list = list.filter((s) => !s.unsubscribedAt);
    } else if (tab === "unsubscribed") {
      list = list.filter((s) => s.unsubscribedAt);
    }

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((s) => s.email.toLowerCase().includes(q) || s.source.toLowerCase().includes(q));
    }
    return list;
  }, [subscribers, tab, query]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  if (currentPage > totalPages && totalPages > 0) {
    setCurrentPage(totalPages);
  }

  async function handleToggleStatus(sub: Subscriber) {
    const willUnsubscribe = !sub.unsubscribedAt;
    const ok = await confirm({
      title: willUnsubscribe ? "Unsubscribe this reader?" : "Reactivate this subscriber?",
      description: willUnsubscribe
        ? `"${sub.email}" will stop receiving newsletter emails until reactivated.`
        : `"${sub.email}" will start receiving newsletter emails again.`,
      confirmLabel: willUnsubscribe ? "Unsubscribe" : "Reactivate",
      danger: willUnsubscribe,
    });
    if (!ok) return;

    setBusyId(sub.id);
    try {
      const res = await fetch(`/api/admin/newsletter/${sub.id}`, {
        method: "PATCH",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update subscriber.");
      setSubscribers((prev) => prev.map((s) => (s.id === sub.id ? data.subscriber : s)));
      toast.success(
        data.subscriber.unsubscribedAt
          ? `Marked ${sub.email} as unsubscribed.`
          : `Reactivated ${sub.email}.`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error updating subscriber.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(sub: Subscriber) {
    const ok = await confirm({
      title: "Remove Subscriber",
      description: `Are you sure you want to completely remove "${sub.email}" from the newsletter list?`,
      confirmLabel: "Delete Subscriber",
      danger: true,
    });
    if (!ok) return;

    setBusyId(sub.id);
    try {
      const res = await fetch(`/api/admin/newsletter/${sub.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete subscriber.");
      setSubscribers((prev) => prev.filter((s) => s.id !== sub.id));
      toast.success(`Removed ${sub.email} from newsletter.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error removing subscriber.");
    } finally {
      setBusyId(null);
    }
  }

  function handleExportCsv() {
    if (filtered.length === 0) {
      toast.error("No subscribers to export.");
      return;
    }
    const header = "Email,Source,Subscribed Date,Status\n";
    const rows = filtered
      .map(
        (s) =>
          `"${s.email}","${s.source}","${s.createdAt}","${s.unsubscribedAt ? "Unsubscribed" : "Active"}"`
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `subscribers-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${filtered.length} subscribers to CSV.`);
  }

  return (
    <div className="font-sans space-y-6 pb-20 text-slate-800 antialiased">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Newsletter Subscribers
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Manage your audience, track subscription channels, and export reader lists.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative min-w-[240px] sm:min-w-[260px]">
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by email or source..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-3.5 pr-8 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#DC2626] focus:outline-none transition-all shadow-2xs"
            />
            <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
          </div>

          {/* Export CSV Button */}
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* 3 KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shrink-0">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-2xl font-extrabold text-slate-900">{counts.total}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-700">Total Subscribers</p>
            <p className="text-[10px] font-semibold text-slate-400 mt-0.5">All time signups</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 shrink-0">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-2xl font-extrabold text-slate-900">{counts.active}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-700">Active Subscribers</p>
            <p className="text-[10px] font-semibold text-emerald-600 mt-0.5">Receiving dispatches</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-[#DC2626] shrink-0">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </div>
            <p className="text-2xl font-extrabold text-slate-900">{counts.unsubscribed}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-700">Unsubscribed</p>
            <p className="text-[10px] font-semibold text-slate-400 mt-0.5">Opted out</p>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-6 border-b border-slate-200 text-xs font-semibold overflow-x-auto no-scrollbar">
        {[
          { key: "all", label: `All Subscribers (${counts.total})` },
          { key: "active", label: `Active (${counts.active})` },
          { key: "unsubscribed", label: `Unsubscribed (${counts.unsubscribed})` },
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

      {/* Table Card */}
      <div className="rounded-2xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50/75 border-b border-slate-200/80 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="py-3.5 px-5 min-w-[280px]">Subscriber</th>
                <th className="py-3.5 px-4 min-w-[140px]">Source</th>
                <th className="py-3.5 px-4 min-w-[140px]">Subscribed Date</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    {subscribers.length === 0
                      ? "No subscribers have joined yet."
                      : "No subscribers match your search/filter."}
                  </td>
                </tr>
              ) : (
                paginated.map((sub) => {
                  const initials = sub.email.slice(0, 1).toUpperCase();
                  const createdDt = formatDateTime(sub.createdAt);
                  const isUnsub = Boolean(sub.unsubscribedAt);
                  const busy = busyId === sub.id;

                  return (
                    <tr key={sub.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Email + Icon */}
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-white font-bold text-xs shrink-0 shadow-2xs">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                              {sub.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Source */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 capitalize">
                          {sub.source.replace(/_/g, " ") || "Website"}
                        </span>
                      </td>

                      {/* Subscribed Date */}
                      <td className="py-3.5 px-4">
                        <div className="text-[11px] leading-tight">
                          <p className="font-semibold text-slate-800">{createdDt.date}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{createdDt.time}</p>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {isUnsub ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 border border-rose-200 px-2.5 py-0.5 text-[11px] font-bold text-[#DC2626]">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#DC2626]" />
                            Unsubscribed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Active
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleToggleStatus(sub)}
                            className={`rounded-lg px-3 py-1 text-[11px] font-semibold transition-colors disabled:opacity-50 cursor-pointer ${
                              isUnsub
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                                : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                            }`}
                          >
                            {isUnsub ? "Reactivate" : "Unsubscribe"}
                          </button>

                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleDelete(sub)}
                            className="rounded-lg border border-slate-200 bg-white p-1 text-slate-400 hover:text-[#DC2626] hover:bg-rose-50 transition-colors disabled:opacity-50 cursor-pointer"
                            title="Delete subscriber permanently"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Pagination */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 border-t border-slate-100 text-xs text-slate-500">
          <p>
            Showing{" "}
            <span className="font-bold text-slate-800">
              {filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
            </span>{" "}
            to{" "}
            <span className="font-bold text-slate-800">
              {Math.min(currentPage * pageSize, filtered.length)}
            </span>{" "}
            of <span className="font-bold text-slate-800">{filtered.length}</span> subscriber
            {filtered.length === 1 ? "" : "s"}
          </p>

          {totalPages > 1 && (
            <div className="flex items-center gap-1.5 self-center">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                &lt;
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
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
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                &gt;
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 shadow-2xs focus:border-[#DC2626] focus:outline-none cursor-pointer"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
