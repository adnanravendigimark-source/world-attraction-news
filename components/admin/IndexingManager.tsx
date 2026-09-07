"use client";

import { useState, useMemo } from "react";
import type { IndexingRow, IndexingPageType } from "@/lib/indexing";
import { useConfirm } from "@/components/ConfirmProvider";

function SwitchToggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ease-in-out cursor-pointer focus:outline-hidden disabled:opacity-50 ${
        checked ? "bg-emerald-500" : "bg-slate-300"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function sectionTitle(type: IndexingPageType) {
  switch (type) {
    case "core":
      return "Core Site Pages";
    case "legal":
      return "Legal & Policy Pages";
    case "destination":
      return "Destinations & City Hubs";
    case "category":
      return "Category Pages";
    case "article":
      return "Published Articles";
    default:
      return "Other Pages";
  }
}

export default function IndexingManager({ initial }: { initial: IndexingRow[] }) {
  const confirm = useConfirm();
  const [rows, setRows] = useState<IndexingRow[]>(initial);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | IndexingPageType | "blocked">("all");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [loadingKeys, setLoadingKeys] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  // Instant single toggle for a row (1-click, index + follow together)
  async function togglePage(row: IndexingRow) {
    const nextNoIndex = !row.noIndex; // if true, page becomes noindexed
    const nextNoFollow = nextNoIndex;

    // Optimistic update
    setRows((prev) =>
      prev.map((r) =>
        r.key === row.key ? { ...r, noIndex: nextNoIndex, noFollow: nextNoFollow } : r
      )
    );

    setLoadingKeys((prev) => new Set(prev).add(row.key));

    try {
      const res = await fetch("/api/admin/indexing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: row.key,
          type: row.type,
          label: row.label,
          url: row.url,
          noIndex: nextNoIndex,
          noFollow: nextNoFollow,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to update");
      }

      showToast(
        nextNoIndex
          ? `⛔ "${row.label}" set to NoIndex, NoFollow.`
          : `🟢 "${row.label}" set to Index, Follow.`
      );
    } catch {
      // Revert on error
      setRows((prev) =>
        prev.map((r) =>
          r.key === row.key ? { ...r, noIndex: row.noIndex, noFollow: row.noFollow } : r
        )
      );
      showToast(`Could not update "${row.label}". Please try again.`, "error");
    } finally {
      setLoadingKeys((prev) => {
        const next = new Set(prev);
        next.delete(row.key);
        return next;
      });
    }
  }

  // Bulk action for specific rows
  async function bulkSet(targetRows: IndexingRow[], targetNoIndex: boolean) {
    if (!targetRows.length) return;
    const ok = await confirm({
      title: targetNoIndex ? `Hide ${targetRows.length} page(s) from search engines?` : `Make ${targetRows.length} page(s) indexable again?`,
      description: targetNoIndex
        ? "These pages will be set to NoIndex, NoFollow and will be dropped from search results over time."
        : "These pages will be set to Index, Follow and become eligible to appear in search results again.",
      confirmLabel: targetNoIndex ? "Set NoIndex" : "Set Index",
      danger: targetNoIndex,
    });
    if (!ok) return;
    setBulkLoading(true);

    const keysToUpdate = new Set(targetRows.map((r) => r.key));

    // Optimistic update
    setRows((prev) =>
      prev.map((r) =>
        keysToUpdate.has(r.key)
          ? { ...r, noIndex: targetNoIndex, noFollow: targetNoIndex }
          : r
      )
    );

    try {
      const payloadItems = targetRows.map((r) => ({
        key: r.key,
        type: r.type,
        label: r.label,
        url: r.url,
        noIndex: targetNoIndex,
        noFollow: targetNoIndex,
      }));

      const res = await fetch("/api/admin/indexing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: payloadItems }),
      });

      if (!res.ok) throw new Error("Bulk update failed");

      showToast(
        targetNoIndex
          ? `⛔ ${targetRows.length} page(s) set to NoIndex, NoFollow.`
          : `🟢 ${targetRows.length} page(s) set to Index, Follow.`
      );
    } catch {
      // Refresh state from server
      const ref = await fetch("/api/admin/indexing").then((r) => r.json()).catch(() => []);
      if (Array.isArray(ref)) setRows(ref);
      showToast("Bulk update encountered an error.", "error");
    } finally {
      setBulkLoading(false);
    }
  }

  // Stats calculation
  const totalCount = rows.length;
  const blockedCount = rows.filter((r) => r.noIndex).length;
  const indexedCount = totalCount - blockedCount;

  // Filtered rows
  const filteredRows = useMemo(() => {
    let list = rows;

    if (activeTab === "blocked") {
      list = list.filter((r) => r.noIndex);
    } else if (activeTab !== "all") {
      list = list.filter((r) => r.type === activeTab);
    }

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) => r.label.toLowerCase().includes(q) || r.url.toLowerCase().includes(q)
      );
    }

    return list;
  }, [rows, activeTab, search]);

  // Grouping
  const grouped = useMemo(() => {
    const order: IndexingPageType[] = ["core", "legal", "destination", "category", "article"];
    const map: Record<string, { type: IndexingPageType; rows: IndexingRow[] }> = {};
    for (const t of order) {
      const inType = filteredRows.filter((r) => r.type === t);
      if (inType.length > 0) {
        map[sectionTitle(t)] = { type: t, rows: inType };
      }
    }
    return map;
  }, [filteredRows]);

  return (
    <div className="space-y-5">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-bold shadow-xl transition-all animate-bounce ${
            toast.type === "success"
              ? "bg-slate-900 text-white border border-slate-700"
              : "bg-rose-600 text-white"
          }`}
        >
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Top Overview & Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Tracked Pages</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{totalCount}</p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Indexed &amp; Followed</p>
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
          </div>
          <p className="text-2xl font-black text-emerald-800 mt-1">{indexedCount}</p>
        </div>
        <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-rose-700">NoIndex &amp; NoFollow</p>
            <span className="h-2 w-2 rounded-full bg-rose-500" />
          </div>
          <p className="text-2xl font-black text-rose-800 mt-1">{blockedCount}</p>
        </div>
      </div>

      {/* Controls Header: Tabs + Search + Bulk Actions */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs space-y-4">
        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-1.5 border-b border-slate-100 pb-3">
          {[
            { id: "all", label: "All Pages", count: totalCount },
            { id: "core", label: "Core Pages", count: rows.filter((r) => r.type === "core").length },
            { id: "article", label: "Articles", count: rows.filter((r) => r.type === "article").length },
            { id: "destination", label: "Destinations", count: rows.filter((r) => r.type === "destination").length },
            { id: "category", label: "Categories", count: rows.filter((r) => r.type === "category").length },
            { id: "legal", label: "Legal", count: rows.filter((r) => r.type === "legal").length },
            { id: "blocked", label: "⛔ Blocked Only", count: blockedCount },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                activeTab === tab.id
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-100/70 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900"
              }`}
            >
              {tab.label} <span className="opacity-70 ml-1 text-[11px]">({tab.count})</span>
            </button>
          ))}
        </div>

        {/* Search & Global Bulk Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by page title or URL..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2 pl-9 text-xs text-slate-900 focus:border-[#DC2626] focus:bg-white focus:outline-hidden"
            />
            <svg
              className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={bulkLoading || filteredRows.length === 0}
              onClick={() => bulkSet(filteredRows, false)}
              className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-50 cursor-pointer"
            >
              ✓ Index All in View
            </button>
            <button
              type="button"
              disabled={bulkLoading || filteredRows.length === 0}
              onClick={() => bulkSet(filteredRows, true)}
              className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 transition-colors disabled:opacity-50 cursor-pointer"
            >
              ⛔ NoIndex All in View
            </button>
          </div>
        </div>
      </div>

      {/* Pages List with One-Toggle Controls */}
      <div className="space-y-4">
        {Object.entries(grouped).map(([title, group]) => (
          <div
            key={title}
            className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden"
          >
            {/* Section Header with Quick Section Bulk Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 sm:px-6 py-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                  {title}
                </span>
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                  {group.rows.length}
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-xs">
                <button
                  type="button"
                  disabled={bulkLoading}
                  onClick={() => bulkSet(group.rows, false)}
                  className="rounded-lg px-2 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100/70 transition-colors cursor-pointer"
                >
                  Index Section
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  disabled={bulkLoading}
                  onClick={() => bulkSet(group.rows, true)}
                  className="rounded-lg px-2 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-100/70 transition-colors cursor-pointer"
                >
                  NoIndex Section
                </button>
              </div>
            </div>

            {/* Section Items */}
            <div className="divide-y divide-slate-100">
              {group.rows.map((row) => {
                const isIndexed = !row.noIndex;
                const isPending = loadingKeys.has(row.key);

                return (
                  <div
                    key={row.key}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-6 py-3.5 hover:bg-slate-50/70 transition-colors"
                  >
                    {/* Page info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {row.label}
                        </p>
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                            isIndexed
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}
                        >
                          {isIndexed ? "Index & Follow" : "NoIndex & NoFollow"}
                        </span>
                      </div>
                      <p className="text-[11px] font-mono text-slate-400 truncate mt-0.5">
                        {row.url}
                      </p>
                    </div>

                    {/* Single Clean Toggle Button */}
                    <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                      <span className="text-xs font-semibold text-slate-600 hidden md:inline">
                        {isIndexed ? (
                          <span className="text-emerald-700">🟢 Search Engine Visible</span>
                        ) : (
                          <span className="text-rose-700">⛔ Hidden from Google</span>
                        )}
                      </span>
                      <SwitchToggle
                        checked={isIndexed}
                        disabled={isPending || bulkLoading}
                        onChange={() => togglePage(row)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {filteredRows.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <p className="text-sm font-semibold text-slate-700">No pages matched your filter.</p>
            <p className="text-xs text-slate-400 mt-1">Try resetting your search or filter tab.</p>
          </div>
        )}
      </div>
    </div>
  );
}
