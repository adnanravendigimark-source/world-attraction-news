"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ArticleWithRelations } from "@/lib/articles";
import type { City } from "@/lib/cities";
import type { Category } from "@/lib/categories";
import StatusBadge from "@/components/StatusBadge";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const TABS = [
  "all",
  "pending",
  "under_review",
  "changes_requested",
  "approved",
  "scheduled",
  "published",
  "rejected",
  "draft",
] as const;

const TAB_LABELS: Record<string, string> = {
  all: "All Dispatches",
  pending: "Pending Review",
  under_review: "In Review",
  changes_requested: "Changes Requested",
  approved: "Approved",
  scheduled: "Scheduled",
  published: "Published",
  rejected: "Rejected",
  draft: "Drafts",
};

export default function ArticlesQueue({
  initialArticles,
  cities,
  categories,
}: {
  initialArticles: ArticleWithRelations[];
  cities: City[];
  categories: Category[];
}) {
  const searchParams = useSearchParams();
  const [filter, setFilter] = useState(searchParams.get("status") || "all");
  const [query, setQuery] = useState("");
  const [cityId, setCityId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [author, setAuthor] = useState("");
  const [dateFrom, setDateFrom] = useState("");

  const authors = useMemo(() => {
    const seen = new Map<string, string>();
    for (const a of initialArticles) seen.set(a.authorEmail, a.authorName);
    return Array.from(seen.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [initialArticles]);

  const counts = {
    pending: initialArticles.filter((a) => a.status === "pending").length,
    under_review: initialArticles.filter((a) => a.status === "under_review").length,
    changes_requested: initialArticles.filter((a) => a.status === "changes_requested").length,
    approved: initialArticles.filter((a) => a.status === "approved").length,
    scheduled: initialArticles.filter((a) => a.status === "scheduled").length,
    published: initialArticles.filter((a) => a.status === "published").length,
    rejected: initialArticles.filter((a) => a.status === "rejected").length,
    draft: initialArticles.filter((a) => a.status === "draft").length,
  };

  const filtered = useMemo(() => {
    let list = filter === "all" ? initialArticles : initialArticles.filter((a) => a.status === filter);
    if (cityId) list = list.filter((a) => a.cityId === cityId);
    if (categoryId) list = list.filter((a) => a.categoryId === categoryId);
    if (author) list = list.filter((a) => a.authorEmail === author);
    if (dateFrom) {
      const from = new Date(dateFrom).getTime();
      list = list.filter((a) => new Date(a.submittedAt || a.updatedAt).getTime() >= from);
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.authorName.toLowerCase().includes(q) ||
          a.cityName.toLowerCase().includes(q) ||
          a.contentHtml.toLowerCase().includes(q)
      );
    }
    return list;
  }, [initialArticles, filter, cityId, categoryId, author, dateFrom, query]);

  return (
    <div className="space-y-6">
      {/* Status Pill Filters */}
      <div className="flex flex-wrap gap-2 border-b border-ink-100 pb-4">
        {TABS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-bold transition-all ${
              filter === f
                ? "border-ink-950 bg-ink-950 text-white shadow-card"
                : "border-ink-200 bg-white text-ink-700 hover:border-ink-400"
            }`}
          >
            {TAB_LABELS[f] || f}
            {f !== "all" && counts[f as keyof typeof counts] > 0 && (
              <span className="ml-1.5 font-mono text-[10px] opacity-75">
                ({counts[f as keyof typeof counts]})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Advanced Filter Toolbar */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-2xl border border-ink-200/80 shadow-subtle">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search headline, writer, city, body..."
          className="flex-1 min-w-[220px] rounded-lg border border-ink-200 bg-paper-50 px-3 py-1.5 text-xs focus:border-signal focus:outline-none"
        />
        <select
          value={cityId}
          onChange={(e) => setCityId(e.target.value)}
          className="rounded-lg border border-ink-200 bg-paper-50 px-3 py-1.5 text-xs font-semibold"
        >
          <option value="">All Destinations</option>
          {cities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="rounded-lg border border-ink-200 bg-paper-50 px-3 py-1.5 text-xs font-semibold"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          className="rounded-lg border border-ink-200 bg-paper-50 px-3 py-1.5 text-xs font-semibold"
        >
          <option value="">All Correspondents</option>
          {authors.map(([email, name]) => (
            <option key={email} value={email}>
              {name}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          title="Submitted on or after"
          className="rounded-lg border border-ink-200 bg-paper-50 px-2 py-1.5 text-xs font-mono"
        />
      </div>

      {/* Filtered Articles Table / Queue */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-300 bg-white p-12 text-center shadow-subtle">
          <p className="font-serif text-base font-bold text-ink-800">No dispatches match your filter criteria.</p>
          <p className="mt-1 text-xs text-ink-500">Try clearing query terms or selecting a different status filter.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => (
            <Link
              key={a.id}
              href={`/admin/articles/${a.id}`}
              className="group flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-ink-200/80 bg-white p-4 sm:p-5 shadow-card hover:border-ink-400 hover:shadow-lift transition-all"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1 text-[10px] font-mono font-bold uppercase tracking-wider text-signal">
                  <span>{a.cityName} Bureau</span>
                  {a.categoryName && (
                    <>
                      <span className="text-ink-300">/</span>
                      <span className="text-ink-500">{a.categoryName}</span>
                    </>
                  )}
                  {a.breaking && (
                    <span className="rounded bg-signal px-1.5 py-0.2 text-white">Live</span>
                  )}
                </div>
                <h3 className="font-serif text-base font-bold text-ink-950 group-hover:text-signal transition-colors">
                  {a.title || "Untitled Draft"}
                </h3>
                <p className="mt-1 text-xs text-ink-500 font-mono">
                  By {a.authorName} ({a.authorEmail}) · Submitted {formatDate(a.submittedAt)}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-3 self-end sm:self-center">
                {a.score !== null && (
                  <span className="rounded-md bg-amber-100 px-2 py-0.5 font-mono text-xs font-bold text-amber-900">
                    ★ {a.score}/10
                  </span>
                )}
                {a.originalityFlag && (
                  <span className="rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-amber-900">
                    ⚠ Overlap
                  </span>
                )}
                <StatusBadge status={a.status} />
                <span className="rounded-lg bg-paper-100 group-hover:bg-ink-950 group-hover:text-white px-3 py-1.5 text-xs font-bold transition-all">
                  Open →
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
