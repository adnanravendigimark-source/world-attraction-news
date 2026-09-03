"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { ArticleWithRelations } from "@/lib/articles";
import StatusBadge from "@/components/StatusBadge";
import ScoreBadge from "@/components/ScoreBadge";
import { useConfirm } from "@/components/ConfirmProvider";
import { useToast } from "@/components/ToastProvider";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatViews(n: number) {
  return n > 999 ? `${(n / 1000).toFixed(1)}K` : String(n);
}

// Mirrors the full ArticleStatus union from lib/articles.ts — every status a
// contributor's own article can be in needs its own tab, or that article
// becomes invisible in "All" filtering-by-eye with no way to find it.
const TABS = [
  { key: "all", label: "All" },
  { key: "draft", label: "Drafts" },
  { key: "pending", label: "Pending" },
  { key: "under_review", label: "Under Review" },
  { key: "changes_requested", label: "Changes Requested" },
  { key: "approved", label: "Approved" },
  { key: "scheduled", label: "Scheduled" },
  { key: "published", label: "Published" },
  { key: "rejected", label: "Rejected" },
  { key: "unpublished", label: "Unpublished" },
] as const;

// Only these statuses can still be opened in the editor and resubmitted —
// mirrors EDITABLE_STATUSES in ArticleEditor.tsx and the same guard
// app/api/dashboard/articles/[id]/route.ts's PATCH handler enforces
// server-side.
const RESUBMITTABLE = new Set(["pending", "rejected", "changes_requested"]);

// "View" always stays inside the Contributor Panel (the article's own
// status/detail page) rather than sometimes jumping straight to the public
// site — one predictable destination per row instead of the click target
// silently changing based on status. The detail page itself still offers an
// "Open Live Story" link out to the public site once something is published.
function detailHref(id: string) {
  return `/contributor/articles/${id}`;
}
function editHref(id: string) {
  return `/contributor/articles/${id}/edit`;
}

export default function ArticlesList({ articles }: { articles: ArticleWithRelations[] }) {
  const confirm = useConfirm();
  const toast = useToast();
  const [filter, setFilter] = useState("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);

  const visibleArticles = useMemo(() => articles.filter((a) => !deletedIds.includes(a.id)), [articles, deletedIds]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: visibleArticles.length };
    for (const tab of TABS) {
      if (tab.key === "all") continue;
      c[tab.key] = visibleArticles.filter((a) => a.status === tab.key).length;
    }
    return c;
  }, [visibleArticles]);

  const filtered = useMemo(
    () => (filter === "all" ? visibleArticles : visibleArticles.filter((a) => a.status === filter)),
    [visibleArticles, filter]
  );

  // Only a never-submitted draft can be discarded here — matches the real
  // rule enforced server-side in app/api/dashboard/articles/[id]/route.ts's
  // DELETE handler (409 for anything past "draft").
  async function handleDelete(id: string, title: string) {
    const ok = await confirm({
      title: `Discard "${title || "this draft"}"?`,
      description: "This permanently deletes this draft. It was never submitted for review, so nothing else is affected.",
      confirmLabel: "Discard Draft",
      danger: true,
    });
    if (!ok) return;

    setBusyId(id);
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
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">My Articles</h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Every article you've written, from first draft to publication.
          </p>
        </div>
        <Link
          href="/contributor/articles/new"
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#DC2626] px-4 py-2.5 text-xs font-bold text-white shadow-2xs hover:bg-[#B91C1C] transition-colors"
        >
          + Write Article
        </Link>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {TABS.filter((tab) => tab.key === "all" || counts[tab.key] > 0).map((tab) => {
          const isActive = filter === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                isActive
                  ? "bg-[#DC2626] text-white shadow-sm"
                  : "bg-white border border-slate-200/90 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              {tab.label}
              <span className={`ml-1.5 text-[10px] font-mono ${isActive ? "text-white/70" : "text-slate-400"}`}>
                {counts[tab.key] || 0}
              </span>
            </button>
          );
        })}
      </div>

      {/* Article List */}
      <div className="rounded-2xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <p className="text-sm text-slate-400">
              {visibleArticles.length === 0
                ? "You haven't written anything yet."
                : "No articles in this view."}
            </p>
            {visibleArticles.length === 0 && (
              <Link
                href="/contributor/articles/new"
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#DC2626] px-4 py-2 text-xs font-bold text-white hover:bg-[#B91C1C] transition-colors"
              >
                Write Your First Article →
              </Link>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((art) => {
              const isBusy = busyId === art.id;
              const href = art.status === "draft" ? editHref(art.id) : detailHref(art.id);

              return (
                <div key={art.id} className="flex flex-wrap sm:flex-nowrap items-center gap-3.5 p-4 sm:p-5 hover:bg-slate-50/60 transition-colors">
                  {/* Thumbnail */}
                  <Link href={href} className="shrink-0">
                    <div className="relative h-14 w-16 sm:w-20 rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                      {art.image && <Image src={art.image} alt="" fill className="object-cover" />}
                    </div>
                  </Link>

                  {/* Title + Meta */}
                  <div className="min-w-0 flex-1">
                    <Link
                      href={href}
                      className="block text-sm font-bold text-slate-900 hover:text-[#DC2626] transition-colors line-clamp-1"
                    >
                      {art.title || "Untitled Draft"}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <StatusBadge status={art.status} />
                      <span className="text-[11px] text-slate-400">
                        {art.cityName}
                        {art.categoryName ? ` · ${art.categoryName}` : ""}
                        {" · "}
                        {art.status === "draft" ? "Saved" : "Updated"} {formatDate(art.updatedAt)}
                        {art.viewCount > 0 ? ` · 👁 ${formatViews(art.viewCount)}` : ""}
                      </span>
                      {art.score !== null && <ScoreBadge score={art.score} />}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 items-center gap-4 text-xs font-bold ml-auto sm:ml-0">
                    {art.status === "draft" ? (
                      <>
                        <Link href={editHref(art.id)} className="text-[#DC2626] hover:text-[#B91C1C] transition-colors">
                          Edit
                        </Link>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleDelete(art.id, art.title)}
                          className="text-rose-600 hover:text-rose-700 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {isBusy ? "Deleting…" : "Delete"}
                        </button>
                      </>
                    ) : (
                      <>
                        <Link href={detailHref(art.id)} className="text-slate-500 hover:text-slate-900 transition-colors">
                          View
                        </Link>
                        {RESUBMITTABLE.has(art.status) && (
                          <Link href={editHref(art.id)} className="text-[#DC2626] hover:text-[#B91C1C] transition-colors">
                            Edit
                          </Link>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Help Line */}
      <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 pt-2">
        <span className="flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[10px]">?</span>
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
