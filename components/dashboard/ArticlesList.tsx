"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { ArticleWithRelations } from "@/lib/articles";
import { useConfirm } from "@/components/ConfirmProvider";
import { useToast } from "@/components/ToastProvider";

function formatDateTime(iso: string | null) {
  if (!iso) return { date: "—", time: "" };
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  return { date, time };
}

// Mirrors the full ArticleStatus union from lib/articles.ts — every status a
// contributor's own article can be in needs its own tab, or that article
// becomes invisible in "All Dispatches" filtering-by-eye with no way to find
// it (this previously happened for "pending" and "unpublished").
const TABS = [
  { key: "all", label: "All Dispatches" },
  { key: "draft", label: "Drafts" },
  { key: "pending", label: "Pending Review" },
  { key: "under_review", label: "Under Review" },
  { key: "changes_requested", label: "Changes Requested" },
  { key: "approved", label: "Approved" },
  { key: "scheduled", label: "Scheduled" },
  { key: "published", label: "Published" },
  { key: "rejected", label: "Rejected" },
  { key: "unpublished", label: "Unpublished" },
] as const;

const STATUS_BADGES: Record<string, { icon: string; className: string; label: string }> = {
  published: { icon: "✓", className: "bg-emerald-50 border-emerald-200 text-emerald-700", label: "Published" },
  pending: { icon: "⏱", className: "bg-amber-50 border-amber-200 text-amber-700", label: "Pending Review" },
  under_review: { icon: "⏱", className: "bg-amber-50 border-amber-200 text-amber-700", label: "Under Review" },
  changes_requested: { icon: "●", className: "bg-rose-50 border-rose-200 text-[#DC2626]", label: "Changes Requested" },
  draft: { icon: "●", className: "bg-blue-50 border-blue-200 text-blue-700", label: "Draft" },
  approved: { icon: "✓", className: "bg-emerald-50 border-emerald-200 text-emerald-800", label: "Approved" },
  scheduled: { icon: "◷", className: "bg-blue-50 border-blue-200 text-blue-800", label: "Scheduled" },
  rejected: { icon: "✕", className: "bg-rose-50 border-rose-200 text-rose-800", label: "Rejected" },
  unpublished: { icon: "●", className: "bg-slate-100 border-slate-200 text-slate-600", label: "Unpublished" },
};

export default function ArticlesList({ articles }: { articles: ArticleWithRelations[] }) {
  const confirm = useConfirm();
  const toast = useToast();
  const [filter, setFilter] = useState("all");
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);

  const visibleArticles = useMemo(
    () => articles.filter((a) => !deletedIds.includes(a.id)),
    [articles, deletedIds]
  );

  const counts: Record<string, number> = {
    all: visibleArticles.length,
    draft: visibleArticles.filter((a) => a.status === "draft").length,
    pending: visibleArticles.filter((a) => a.status === "pending").length,
    under_review: visibleArticles.filter((a) => a.status === "under_review").length,
    changes_requested: visibleArticles.filter((a) => a.status === "changes_requested").length,
    approved: visibleArticles.filter((a) => a.status === "approved").length,
    scheduled: visibleArticles.filter((a) => a.status === "scheduled").length,
    published: visibleArticles.filter((a) => a.status === "published").length,
    rejected: visibleArticles.filter((a) => a.status === "rejected").length,
    unpublished: visibleArticles.filter((a) => a.status === "unpublished").length,
  };

  const filtered = useMemo(() => {
    if (filter === "all") return visibleArticles;
    return visibleArticles.filter((a) => a.status === filter);
  }, [visibleArticles, filter]);

  // Only a never-submitted draft can be discarded here — matches the real
  // rule enforced server-side in app/api/dashboard/articles/[id]/route.ts's
  // DELETE handler (409 for anything past "draft"). The menu below only
  // offers this option for draft rows, so reaching this function with a
  // non-draft id shouldn't happen — this check is defense in depth in case
  // that ever drifts.
  async function handleDelete(id: string, title: string, status: string) {
    if (status !== "draft") {
      toast.error("Only an unsubmitted draft can be deleted.");
      return;
    }
    const ok = await confirm({
      title: `Discard "${title}"?`,
      description: "This permanently deletes this draft. It was never submitted for review, so nothing else is affected.",
      confirmLabel: "Discard Draft",
      danger: true,
    });
    if (!ok) return;

    setBusyId(id);
    setActionMenuId(null);
    try {
      const res = await fetch(`/api/dashboard/articles/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't delete this draft.");
      setDeletedIds((prev) => [...prev, id]);
      toast.success("Draft deleted.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete this draft.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* 1. Page Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 text-xl shadow-2xs">
          📄
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            My Articles
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Track and manage every dispatch you've written, from first draft to publication.
          </p>
        </div>
      </div>

      {/* 2. Status Filter Horizontal Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {TABS.filter((tab) => tab.key === "all" || counts[tab.key] > 0).map((tab) => {
          const isActive = filter === tab.key;
          const count = counts[tab.key] || 0;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                isActive
                  ? "bg-[#DC2626] text-white shadow-sm font-bold"
                  : "bg-white border border-slate-200/90 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`ml-1.5 rounded-full px-1.5 py-0.2 text-[10px] font-mono ${
                  isActive ? "bg-white/20 text-white" : "text-slate-400"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 3. Articles Data Table */}
      <div className="rounded-2xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50/75 border-b border-slate-200/80 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="py-3.5 px-5 min-w-[320px]">Article</th>
                <th className="py-3.5 px-4 min-w-[150px]">Status</th>
                <th className="py-3.5 px-4">Score</th>
                <th className="py-3.5 px-4">Views</th>
                <th className="py-3.5 px-4 min-w-[120px]">Last Updated</th>
                <th className="py-3.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    {visibleArticles.length === 0
                      ? "You haven't written anything yet. Start your first dispatch to see it here."
                      : "No articles found in this view."}
                  </td>
                </tr>
              ) : (
                filtered.map((art) => {
                  const dt = formatDateTime(art.updatedAt);
                  const isBusy = busyId === art.id;
                  const badge = STATUS_BADGES[art.status] || STATUS_BADGES.draft;

                  return (
                    <tr key={art.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Column 1: Article Thumbnail & Title */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3.5">
                          <div className="relative h-12 w-16 sm:w-20 rounded-xl overflow-hidden bg-slate-100 shrink-0 border border-slate-200">
                            {art.image && (
                              <Image src={art.image} alt={art.title || "Article"} fill className="object-cover" />
                            )}
                          </div>
                          <div className="min-w-0 space-y-0.5">
                            <Link
                              href={`/contributor/articles/${art.id}`}
                              className="font-bold text-slate-900 text-xs sm:text-sm hover:text-[#DC2626] transition-colors line-clamp-1 block"
                            >
                              {art.title || "Untitled Draft"}
                            </Link>
                            <p className="text-[11px] font-medium text-slate-400">
                              <span className="text-[#DC2626] font-semibold">{art.cityName}</span>
                              {art.categoryName ? (
                                <>
                                  {" • "}
                                  <span>{art.categoryName}</span>
                                </>
                              ) : null}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Column 2: Status */}
                      <td className="py-4 px-4">
                        <div className="space-y-1">
                          <span
                            className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-bold ${badge.className}`}
                          >
                            {badge.icon} {badge.label}
                          </span>
                          <p className="text-[10px] text-slate-400">
                            {art.status === "published"
                              ? `Published ${dt.date}`
                              : art.status === "draft"
                              ? `Saved ${dt.date}`
                              : `Updated ${dt.date}`}
                          </p>
                        </div>
                      </td>

                      {/* Column 3: Score */}
                      <td className="py-4 px-4">
                        {art.score !== null ? (
                          <span
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-mono font-bold ${
                              art.score >= 9
                                ? "bg-amber-50 text-amber-800 border border-amber-200"
                                : "bg-rose-50 text-rose-800 border border-rose-200"
                            }`}
                          >
                            {art.score}/10 ★
                          </span>
                        ) : (
                          <span className="text-slate-300 font-bold">—</span>
                        )}
                      </td>

                      {/* Column 4: Views */}
                      <td className="py-4 px-4">
                        {art.viewCount ? (
                          <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-600">
                            <span className="text-slate-400">👁</span>{" "}
                            {art.viewCount > 999 ? `${(art.viewCount / 1000).toFixed(1)}K` : art.viewCount}
                          </span>
                        ) : (
                          <span className="text-slate-300 font-bold">—</span>
                        )}
                      </td>

                      {/* Column 5: Last Updated */}
                      <td className="py-4 px-4">
                        <div className="text-[11px] leading-tight">
                          <p className="font-semibold text-slate-700">{dt.date}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{dt.time}</p>
                        </div>
                      </td>

                      {/* Column 6: Actions */}
                      <td className="py-4 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* View Button */}
                          <Link
                            href={art.status === "published" ? `/latest-news/${art.slug}` : `/contributor/articles/${art.id}`}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-900 hover:bg-slate-50 transition-colors"
                            title="View Dispatch"
                          >
                            👁
                          </Link>

                          {/* Edit Button — only while it's actually editable (see the
                              same status guard in the [id]/edit page and the PATCH route) */}
                          {(art.status === "draft" || art.status === "pending" || art.status === "rejected" || art.status === "changes_requested") && (
                            <Link
                              href={`/contributor/articles/${art.id}/edit`}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-900 hover:bg-slate-50 transition-colors"
                              title="Edit Article"
                            >
                              ✏️
                            </Link>
                          )}

                          {/* More Options Dropdown */}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setActionMenuId(actionMenuId === art.id ? null : art.id)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer"
                              title="More Options"
                            >
                              •••
                            </button>

                            {actionMenuId === art.id && (
                              <div className="absolute right-0 z-20 mt-1 w-40 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg text-xs space-y-0.5">
                                <Link
                                  href={`/contributor/articles/${art.id}`}
                                  className="block rounded-lg px-2.5 py-1.5 text-slate-700 hover:bg-slate-50 font-medium"
                                >
                                  Status Detail
                                </Link>
                                {art.status === "draft" && (
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => handleDelete(art.id, art.title, art.status)}
                                    className="block w-full text-left rounded-lg px-2.5 py-1.5 text-rose-600 hover:bg-rose-50 font-medium cursor-pointer disabled:opacity-50"
                                  >
                                    {isBusy ? "Deleting..." : "Delete Draft"}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-white px-5 py-3.5 text-xs text-slate-500">
          <p>
            Showing {filtered.length} of {visibleArticles.length} article{visibleArticles.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      {/* 4. Bottom Help Line */}
      <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 pt-2">
        <span className="flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[10px]">
          ?
        </span>
        <span>
          Need help? Visit our{" "}
          <Link href="/about" className="font-semibold text-[#DC2626] hover:underline">
            Writer Guide
          </Link>{" "}
          or{" "}
          <Link href="/contact" className="font-semibold text-[#DC2626] hover:underline">
            Contact Support
          </Link>
        </span>
      </div>
    </div>
  );
}
