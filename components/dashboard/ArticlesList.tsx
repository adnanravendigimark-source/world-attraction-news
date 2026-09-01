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
  "rejected",
] as const;

function tabLabel(t: string) {
  if (t === "all") return "All";
  return t
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default function ArticlesList({ articles }: { articles: ArticleWithRelations[] }) {
  const [filter, setFilter] = useState<(typeof TABS)[number]>("all");

  const counts = Object.fromEntries(TABS.map((t) => [t, t === "all" ? articles.length : articles.filter((a) => a.status === t).length]));
  const filtered = filter === "all" ? articles : articles.filter((a) => a.status === filter);

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              filter === t ? "border-ink-900 bg-ink-900 text-white" : "border-ink-200 bg-white text-ink-600 hover:border-ink-400"
            }`}
          >
            {tabLabel(t)}
            {counts[t] > 0 ? ` (${counts[t]})` : ""}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-ink-300 bg-white p-10 text-center">
          <p className="text-sm text-ink-500">Nothing here yet.</p>
          <Link href="/dashboard/articles/new" className="mt-3 inline-block text-sm font-semibold text-signal hover:underline">
            Write a new article →
          </Link>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {filtered.map((a) => (
            <div key={a.id} className="rounded-lg border border-ink-200 bg-white p-4 sm:p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <h2 className="font-serif text-base font-bold text-ink-900">{a.title || "Untitled draft"}</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={a.status} />
                  {a.score !== null && (
                    <span className="shrink-0 whitespace-nowrap text-xs font-semibold text-ink-600">Score: {a.score}/10</span>
                  )}
                </div>
              </div>
              {a.excerpt && <p className="mt-1.5 line-clamp-2 text-xs text-ink-600">{a.excerpt}</p>}
              <div className="mt-2 text-[11px] text-ink-400">
                {a.cityName} · Updated {formatDate(a.updatedAt)}
                {a.status !== "draft" && a.submittedAt ? ` · Submitted ${formatDate(a.submittedAt)}` : ""}
                {a.publishedAt ? ` · Published ${formatDate(a.publishedAt)}` : ""}
              </div>

              {a.adminFeedback && (
                <div className="mt-3 rounded border border-ink-200 bg-ink-50 p-3 text-xs text-ink-700">
                  <span className="font-semibold text-ink-800">Editor feedback: </span>
                  {a.adminFeedback}
                </div>
              )}

              <div className="mt-3 flex items-center gap-3">
                {a.status === "draft" && (
                  <Link href={`/dashboard/articles/${a.id}/edit`} className="text-xs font-semibold text-signal hover:underline">
                    Continue Writing →
                  </Link>
                )}
                {(a.status === "rejected" || a.status === "changes_requested") && (
                  <Link href={`/dashboard/articles/${a.id}/edit`} className="text-xs font-semibold text-signal hover:underline">
                    Edit &amp; Resubmit →
                  </Link>
                )}
                {a.status !== "draft" && (
                  <Link href={`/dashboard/articles/${a.id}`} className="text-xs font-semibold text-ink-600 hover:underline">
                    View Details →
                  </Link>
                )}
                {a.status === "published" && (
                  <Link href={`/cities/${a.citySlug}/${a.slug}`} target="_blank" className="text-xs font-semibold text-signal hover:underline">
                    View Live →
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
