"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import NewsStories from "@/components/admin/NewsStories";
import { useToast } from "@/components/ToastProvider";
import type { NewsItem, NewsRun, NewsStats } from "@/lib/news/items";

interface Props {
  initialStats: NewsStats;
  initialRuns: NewsRun[];
  sources: { id: string; name: string }[];
  categories: string[];
  canEdit: boolean;
}

function ago(iso: string | null): string {
  if (!iso) return "never";
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

export default function NewsFeed({ initialStats, initialRuns, sources, categories, canEdit }: Props) {
  const toast = useToast();
  const [items, setItems] = useState<NewsItem[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState(initialStats);
  const [runs, setRuns] = useState(initialRuns);
  const [q, setQ] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [relevance, setRelevance] = useState("");
  const [refiltering, setRefiltering] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [limit, setLimit] = useState(50);
  const [tab, setTab] = useState<"stories" | "items">("stories");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ q, sourceId, category, status, relevance, limit: String(limit) });
      const res = await fetch(`/api/admin/news/items?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load items.");
      setItems(data.items);
      setTotal(data.total);
    } catch (err: any) {
      toast.error(err.message || "Could not load items.");
    } finally {
      setLoading(false);
    }
  }, [q, sourceId, category, status, relevance, limit, toast]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  async function fetchNow() {
    setFetching(true);
    try {
      const res = await fetch("/api/admin/news/fetch", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Fetch failed.");
      const s = data.summary;
      if (s.sourcesChecked === 0) toast.error("No active sources. Add some under Sources.");
      else if (s.errors > 0) toast.error(`${s.itemsNew} new items; ${s.errors} source(s) failed. See Sources.`);
      else toast.success(`${s.itemsNew} new items from ${s.sourcesChecked} sources.`);
      setStats((prev) => ({ ...prev, total: prev.total + s.itemsNew, last24h: prev.last24h + s.itemsNew, lastRunAt: new Date().toISOString() }));
      setRuns((prev) => [
        {
          id: s.runId ?? Date.now(),
          trigger: s.trigger,
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          sourcesChecked: s.sourcesChecked,
          itemsFound: s.itemsFound,
          itemsNew: s.itemsNew,
          errors: s.errors,
        },
        ...prev,
      ].slice(0, 10));
      await load();
    } catch (err: any) {
      toast.error(err.message || "Fetch failed.");
    } finally {
      setFetching(false);
    }
  }

  async function refilter() {
    setRefiltering(true);
    try {
      const res = await fetch("/api/admin/news/filter", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Re-filter failed.");
      toast.success(`Re-scored ${data.count} items.`);
      await load();
    } catch (err: any) {
      toast.error(err.message || "Re-filter failed.");
    } finally {
      setRefiltering(false);
    }
  }

  async function setItemStatus(id: string, next: string) {
    const prev = items;
    setItems((cur) => cur.map((i) => (i.id === id ? { ...i, status: next } : i)));
    const res = await fetch("/api/admin/news/items", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: next }),
    });
    if (!res.ok) {
      setItems(prev);
      toast.error("Could not update item.");
    }
  }

  const input = "rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 focus:border-ink-400 focus:outline-none";

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-bold text-ink-900">Trending News</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-600">
            Raw story leads collected from your sources. These are discovery only — headlines and links, never published
            as-is. Shortlist the promising ones; the research, fact-check and writing steps come next.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/news/automation" className="rounded-lg border border-ink-200 bg-white px-4 py-2 text-sm font-medium text-ink-800 hover:bg-ink-50">
            Automation
          </Link>
          <Link href="/admin/news/sources" className="rounded-lg border border-ink-200 bg-white px-4 py-2 text-sm font-medium text-ink-800 hover:bg-ink-50">
            Sources
          </Link>
          <Link href="/admin/news/filter" className="rounded-lg border border-ink-200 bg-white px-4 py-2 text-sm font-medium text-ink-800 hover:bg-ink-50">
            Filter
          </Link>
          <Link href="/admin/activity?scope=news" className="rounded-lg border border-ink-200 bg-white px-4 py-2 text-sm font-medium text-ink-800 hover:bg-ink-50">
            Publish log
          </Link>
          {canEdit && (
            <button onClick={refilter} disabled={refiltering} className="rounded-lg border border-ink-200 bg-white px-4 py-2 text-sm font-medium text-ink-800 hover:bg-ink-50 disabled:opacity-60">
              {refiltering ? "Scoring…" : "Re-run filter"}
            </button>
          )}
          {canEdit && (
            <button onClick={fetchNow} disabled={fetching} className="rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white hover:bg-ink-800 disabled:opacity-60">
              {fetching ? "Fetching…" : "Fetch now"}
            </button>
          )}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Items stored", stats.total],
          ["New in 24h", stats.last24h],
          ["Active sources", stats.activeSources],
          ["Failing sources", stats.failingSources],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-xl border border-ink-200 bg-white p-4">
            <div className="text-xs uppercase tracking-wide text-ink-500">{label}</div>
            <div className={`mt-1 text-2xl font-bold ${label === "Failing sources" && Number(value) > 0 ? "text-[#DC2626]" : "text-ink-900"}`}>{value}</div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-ink-500">Last fetch: {ago(stats.lastRunAt)}. Automatic fetch runs every 30 minutes (each source has its own interval).</p>

      <div className="mt-6 flex gap-1 border-b border-ink-200">
        {(["stories", "items"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === t ? "border-ink-900 text-ink-900" : "border-transparent text-ink-500 hover:text-ink-800"}`}
          >
            {t === "stories" ? "Stories" : "All items"}
          </button>
        ))}
      </div>

      {tab === "stories" && (
        <div className="mt-4">
          <NewsStories categories={categories} canEdit={canEdit} />
        </div>
      )}

      {tab === "items" && (
      <>
      <div className="mt-5 flex flex-wrap gap-2">
        <input className={`${input} w-64`} placeholder="Search headlines…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={input} value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
          <option value="">All sources</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select className={input} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select className={input} value={relevance} onChange={(e) => setRelevance(e.target.value)}>
          <option value="">Travel-relevant + borderline</option>
          <option value="relevant">Relevant only</option>
          <option value="borderline">Borderline</option>
          <option value="irrelevant">Filtered out</option>
          <option value="pending">Not yet scored</option>
          <option value="all">Everything</option>
        </select>
        <select className={input} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Any status</option>
          <option value="new">New</option>
          <option value="shortlisted">Shortlisted</option>
          <option value="dismissed">Dismissed</option>
        </select>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-ink-200 bg-white">
        {loading && items.length === 0 ? (
          <div className="p-8 text-center text-sm text-ink-500">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-ink-600">
            {stats.total === 0 ? (
              <>
                Nothing collected yet. Go to <Link href="/admin/news/sources" className="underline">Sources</Link>, click
                “Load recommended sources”, then “Fetch now”.
              </>
            ) : (
              "No items match these filters."
            )}
          </div>
        ) : (
          <ul className="divide-y divide-ink-100">
            {items.map((i) => (
              <li key={i.id} className={`flex gap-4 p-4 ${i.status === "dismissed" ? "opacity-50" : ""}`}>
                <div className="min-w-0 flex-1">
                  <a href={i.url} target="_blank" rel="noopener noreferrer nofollow" className="font-medium text-ink-900 hover:underline">
                    {i.title}
                  </a>
                  {i.description && <p className="mt-1 line-clamp-2 text-sm text-ink-600">{i.description}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
                    <span className="font-medium text-ink-700">{i.sourceName}</span>
                    {i.author && i.author !== i.sourceName && <span>via {i.author}</span>}
                    {(i.relevanceCategory || i.category) && <span className="rounded bg-ink-100 px-1.5 py-0.5">{i.relevanceCategory || i.category}</span>}
                    {i.relevanceScore != null && (
                      <span
                        title={i.filterReason}
                        className={`rounded px-1.5 py-0.5 ${i.filterStatus === "relevant" ? "bg-emerald-100 text-emerald-800" : i.filterStatus === "borderline" ? "bg-amber-100 text-amber-800" : "bg-ink-100 text-ink-600"}`}
                      >
                        travel {i.relevanceScore}
                      </span>
                    )}
                    <span>{ago(i.publishedAt || i.createdAt)}</span>
                    <span title="Source reliability score (0–100), set per source">reliability {i.reliabilityScore}</span>
                    {i.duplicateCount > 0 && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">{i.duplicateCount} other source(s) same headline</span>}
                    {i.status === "shortlisted" && <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-800">shortlisted</span>}
                  </div>
                </div>
                {canEdit && (
                  <div className="flex shrink-0 flex-col gap-1">
                    <button onClick={() => setItemStatus(i.id, i.status === "shortlisted" ? "new" : "shortlisted")} className="rounded border border-ink-200 px-2.5 py-1 text-xs hover:bg-ink-50">
                      {i.status === "shortlisted" ? "Unshortlist" : "Shortlist"}
                    </button>
                    <button onClick={() => setItemStatus(i.id, i.status === "dismissed" ? "new" : "dismissed")} className="rounded border border-ink-200 px-2.5 py-1 text-xs hover:bg-ink-50">
                      {i.status === "dismissed" ? "Restore" : "Dismiss"}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      {items.length < total && (
        <div className="mt-3 text-center">
          <button onClick={() => setLimit((l) => l + 50)} className="rounded-lg border border-ink-200 bg-white px-4 py-2 text-sm hover:bg-ink-50">
            Show more ({items.length} of {total})
          </button>
        </div>
      )}

      </>
      )}

      {runs.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-ink-900">Recent fetch runs</h2>
          <div className="mt-2 overflow-x-auto rounded-xl border border-ink-200 bg-white">
            <table className="w-full text-left text-xs">
              <thead className="bg-ink-50 text-ink-500">
                <tr>
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">Trigger</th>
                  <th className="px-3 py-2">Sources</th>
                  <th className="px-3 py-2">Found</th>
                  <th className="px-3 py-2">New</th>
                  <th className="px-3 py-2">Errors</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {runs.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2">{ago(r.startedAt)}</td>
                    <td className="px-3 py-2">{r.trigger}</td>
                    <td className="px-3 py-2">{r.sourcesChecked}</td>
                    <td className="px-3 py-2">{r.itemsFound}</td>
                    <td className="px-3 py-2">{r.itemsNew}</td>
                    <td className={`px-3 py-2 ${r.errors > 0 ? "font-semibold text-[#DC2626]" : ""}`}>{r.errors}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
