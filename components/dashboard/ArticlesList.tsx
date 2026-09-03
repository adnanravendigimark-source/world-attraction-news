"use client";

import { useState } from "react";
import Link from "next/link";
import type { ArticleWithRelations } from "@/lib/articles";
import StatusBadge from "@/components/StatusBadge";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const TABS = [
  "all",
  "draft",
  "pending",
  "under_review",
  "changes_requested",
  "approved",
  "scheduled",
  "published",
  "unpublished",
  "rejected",
] as const;

const TAB_LABELS: Record<string, string> = {
  all: "All Dispatches",
  draft: "Drafts",
  pending: "Pending Review",
  under_review: "Under Review",
  changes_requested: "Changes Requested",
  approved: "Approved",
  scheduled: "Scheduled",
  published: "Published",
  unpublished: "Unpublished",
  rejected: "Rejected",
};

export default function ArticlesList({ articles }: { articles: ArticleWithRelations[] }) {
  const [filter, setFilter] = useState<(typeof TABS)[number]>("all");

  const counts = Object.fromEntries(
    TABS.map((t) => [t, t === "all" ? articles.length : articles.filter((a) => a.status === t).length])
  );
  const filtered = filter === "all" ? articles : articles.filter((a) => a.status === filter);

  return (
    <div className="space-y-6">
      {/* Category / Status Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-ink-100 pb-4">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-bold transition-all ${filter === t
                ? "border-ink-950 bg-ink-950 text-white shadow-card"
                : "border-ink-200 bg-white text-ink-700 hover:border-ink-400"
              }`}
          >
            {TAB_LABELS[t] || t}
            {counts[t] > 0 && <span className="ml-1.5 opacity-70 font-mono text-[11px]">({counts[t]})</span>}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-300 bg-white p-12 text-center shadow-subtle">
          <p className="font-serif text-base font-bold text-ink-800">No dispatches in this view.</p>
          <p className="mt-1 text-xs text-ink-500">Draft a new story to submit to the editorial desk.</p>
          <Link
            href="/dashboard/articles/new"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-signal px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-card hover:bg-signal-dark"
          >
            + Write New Dispatch
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((a) => (
            <div
              key={a.id}
              className="rounded-2xl border border-ink-200/80 bg-white p-5 sm:p-6 shadow-card transition-all hover:shadow-lift"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="font-serif text-lg font-black text-ink-950">
                  {a.title || "Untitled Draft"}
                </h3>
                <div className="flex items-center gap-3">
                  {a.score !== null && (
                    <span className="rounded-md bg-amber-100 px-2 py-0.5 font-mono text-xs font-bold text-amber-900">
                      Score: {a.score}/10
                    </span>
                  )}
                  <StatusBadge status={a.status} />
                </div>
              </div>

              {a.excerpt && (
                <p className="mt-2 line-clamp-2 text-xs sm:text-sm text-ink-600 leading-relaxed">
                  {a.excerpt}
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] font-mono text-ink-400 border-t border-ink-100 pt-3">
                <span className="font-bold text-ink-700 font-sans">{a.cityName} Bureau</span>
                <span>·</span>
                <span>Updated {formatDate(a.updatedAt)}</span>
                {a.publishedAt && (
                  <>
                    <span>·</span>
                    <span className="text-emerald-700 font-semibold">Published {formatDate(a.publishedAt)}</span>
                  </>
                )}
              </div>

              {a.adminFeedback && (
                <div className="mt-3.5 rounded-xl border border-ink-200 bg-paper-100 p-3.5 text-xs text-ink-800">
                  <div className="flex items-center gap-1.5 text-signal font-bold uppercase text-[10px] font-mono mb-1">
                    <span>Editorial Desk Feedback</span>
                  </div>
                  <p className="leading-relaxed font-sans text-ink-700">"{a.adminFeedback}"</p>
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-4 pt-2">
                {a.status === "draft" && (
                  <Link
                    href={`/dashboard/articles/${a.id}/edit`}
                    className="inline-flex items-center gap-1 rounded-lg bg-ink-900 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-signal transition-all"
                  >
                    <span>Continue Writing</span>
                    <span>→</span>
                  </Link>
                )}
                {(a.status === "rejected" || a.status === "changes_requested") && (
                  <Link
                    href={`/dashboard/articles/${a.id}/edit`}
                    className="inline-flex items-center gap-1 rounded-lg bg-signal px-3.5 py-1.5 text-xs font-bold text-white hover:bg-signal-dark transition-all shadow-subtle"
                  >
                    <span>Edit &amp; Resubmit</span>
                    <span>→</span>
                  </Link>
                )}
                {a.status !== "draft" && (
                  <Link
                    href={`/dashboard/articles/${a.id}`}
                    className="text-xs font-bold text-ink-700 hover:text-signal transition-colors"
                  >
                    View Status &amp; Revisions →
                  </Link>
                )}
                {a.status === "published" && (
                  <Link
                    href={`/cities/${a.citySlug}/${a.slug}`}
                    target="_blank"
                    className="text-xs font-bold text-signal hover:underline ml-auto"
                  >
                    Open Live Story ↗
                  </Link>
                )}
                {a.status === "unpublished" && (
                  <span className="ml-auto text-xs font-semibold text-ink-400">Taken down from the public site</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
