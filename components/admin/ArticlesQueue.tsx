"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ArticleWithRelations } from "@/lib/articles";
import type { City } from "@/lib/cities";
import type { Category } from "@/lib/categories";
import StatusBadge from "@/components/StatusBadge";

function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

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
    approved: initialArticles.filter((a) => a.status === "approved").length,
    published: initialArticles.filter((a) => a.status === "published").length,
    rejected: initialArticles.filter((a) => a.status === "rejected").length,
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
    <div>
      <div className="flex flex-wrap gap-2">
        {(["all", "draft", "pending", "approved", "published", "rejected"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              filter === f ? "border-ink-900 bg-ink-900 text-white" : "border-ink-200 bg-white text-ink-600 hover:border-ink-400"
            }`}
          >
            {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== "all" && f !== "draft" && counts[f as keyof typeof counts] > 0 ? ` (${counts[f as keyof typeof counts]})` : ""}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search title, author, city, content..."
          className="w-64 rounded-md border border-ink-300 px-3 py-1.5 text-xs focus:border-signal focus:outline-none"
        />
        <select value={cityId} onChange={(e) => setCityId(e.target.value)} className="rounded-md border border-ink-300 bg-white px-2 py-1.5 text-xs">
          <option value="">All Cities</option>
          {cities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="rounded-md border border-ink-300 bg-white px-2 py-1.5 text-xs">
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select value={author} onChange={(e) => setAuthor(e.target.value)} className="rounded-md border border-ink-300 bg-white px-2 py-1.5 text-xs">
          <option value="">All Authors</option>
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
          className="rounded-md border border-ink-300 px-2 py-1.5 text-xs"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="mt-6 text-sm text-ink-500">No articles match this filter.</p>
      ) : (
        <div className="mt-4 space-y-2">
          {filtered.map((a) => (
            <Link
              key={a.id}
              href={`/admin/articles/${a.id}`}
              className="flex flex-col gap-2 rounded-lg border border-ink-200 bg-white p-4 hover:border-ink-400 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-ink-900">{a.title || "Untitled draft"}</p>
                <p className="mt-0.5 text-xs text-ink-500">
                  {a.cityName}
                  {a.categoryName ? ` · ${a.categoryName}` : ""} · By {a.authorName} · Submitted {formatDate(a.submittedAt)}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {a.score !== null && (
                  <span className="text-xs font-semibold text-ink-600">Score: {a.score}/10</span>
                )}
                {a.originalityFlag && (
                  <span className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">
                    Flagged
                  </span>
                )}
                <StatusBadge status={a.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
