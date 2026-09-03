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
  "unpublished",
  "rejected",
  "draft",
] as const;

const TAB_LABELS: Record<string, string> = {
  all: "All Articles",
  pending: "Pending Review",
  under_review: "In Review",
  changes_requested: "Changes Requested",
  approved: "Approved",
  scheduled: "Scheduled",
  published: "Published",
  unpublished: "Unpublished",
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
    unpublished: initialArticles.filter((a) => a.status === "unpublished").length,
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
    <div className="space-y-4">
      {/* Status Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar border-b border-slate-200 pb-3">
        {TABS.map((f) => {
          const isActive = filter === f;
          const count = f === "all" ? initialArticles.length : counts[f as keyof typeof counts] || 0;

          return (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                isActive
                  ? "bg-[#DC2626] text-white shadow-2xs font-bold"
                  : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
              }`}
            >
              <span>{TAB_LABELS[f] || f}</span>
              {count > 0 && (
                <span className={`ml-1.5 text-[10px] font-mono ${isActive ? "text-white/85" : "text-slate-400"}`}>
                  ({count})
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Advanced Filter Toolbar */}
      <div className="flex flex-wrap items-center gap-2.5 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="relative flex-1 min-w-[200px]">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search headline, writer, city..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#DC2626] focus:bg-white focus:outline-none"
          />
        </div>

        <select
          value={cityId}
          onChange={(e) => setCityId(e.target.value)}
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 focus:border-[#DC2626] focus:bg-white focus:outline-none"
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
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 focus:border-[#DC2626] focus:bg-white focus:outline-none"
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
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 focus:border-[#DC2626] focus:bg-white focus:outline-none"
        >
          <option value="">All Writers</option>
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
          className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 focus:border-[#DC2626] focus:bg-white focus:outline-none"
        />

        {(query || cityId || categoryId || author || dateFrom) && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setCityId("");
              setCategoryId("");
              setAuthor("");
              setDateFrom("");
            }}
            className="rounded-lg px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Filtered Articles List */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-2xs">
          <p className="text-sm font-semibold text-slate-800">No articles match your filter criteria.</p>
          <p className="mt-0.5 text-xs text-slate-500">Try adjusting your search terms or selecting a different status.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((a) => (
            <Link
              key={a.id}
              href={`/admin/articles/${a.id}`}
              className="group flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-2xs hover:border-slate-300 hover:shadow-xs transition-all"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1 text-[10px] font-bold uppercase tracking-wider text-[#DC2626]">
                  <span>{a.cityName || "Global"} Bureau</span>
                  {a.categoryName && (
                    <>
                      <span className="text-slate-300">•</span>
                      <span className="text-slate-500 font-normal">{a.categoryName}</span>
                    </>
                  )}
                  {a.breaking && (
                    <span className="rounded bg-[#DC2626] px-1.5 py-0.2 text-[9px] text-white">Breaking</span>
                  )}
                </div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-[#DC2626] transition-colors line-clamp-1">
                  {a.title || "Untitled Draft"}
                </h3>
                <p className="mt-0.5 text-[11px] text-slate-500 font-medium">
                  By {a.authorName} ({a.authorEmail}) · {formatDate(a.submittedAt || a.updatedAt)}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2.5 self-end sm:self-center">
                {a.score !== null && (
                  <span className="rounded bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-mono font-bold text-amber-900">
                    ★ {a.score}/10
                  </span>
                )}
                {a.originalityFlag && (
                  <span className="rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">
                    ⚠ Overlap
                  </span>
                )}
                <StatusBadge status={a.status} />
                <span className="rounded-lg bg-slate-900 text-white group-hover:bg-[#DC2626] px-3 py-1.5 text-xs font-bold transition-all shadow-2xs">
                  {a.status === "pending" || a.status === "under_review" ? "Review →" : "Open →"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
