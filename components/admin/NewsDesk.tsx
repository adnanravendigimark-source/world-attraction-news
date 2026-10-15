"use client";

// Trending News, kept simple: fetch the latest news, optionally narrow it to a
// city or country, and generate an article from a story. Scoring, filtering,
// grouping and source checks all run in the background.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useToast } from "@/components/ToastProvider";
import type { Story } from "@/lib/news/stories";
import { generateNewsArticle } from "@/lib/news/clientPipeline";

const PAGE = 20;

function ago(iso: string | null): string {
  if (!iso) return "";
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 1440) return `${Math.round(mins / 60)} h ago`;
  return `${Math.round(mins / 1440)} d ago`;
}

// Three states an editor cares about.
function stateOf(s: Story): { label: string; cls: string; action: "generate" | "open" | "view" } {
  const p = s.pipeline;
  if (p.stage === "published" || p.stage === "scheduled") return { label: p.label, cls: "bg-ink-900 text-white", action: "view" };
  if (p.articleId) {
    const ready = p.stage === "ready" || p.stage === "approved";
    return { label: ready ? "Ready to publish" : "Draft", cls: ready ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900", action: "open" };
  }
  return { label: "New", cls: "bg-ink-100 text-ink-600", action: "generate" };
}

export default function NewsDesk({ lastFetchAt, canEdit }: { lastFetchAt: string | null; canEdit: boolean }) {
  const toast = useToast();
  const [stories, setStories] = useState<Story[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(PAGE);
  const [place, setPlace] = useState("");
  const [placeInput, setPlaceInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [lastFetch, setLastFetch] = useState(lastFetchAt);
  const [generating, setGenerating] = useState<{ id: string; text: string } | null>(null);
  const [tick, setTick] = useState(0);
  // News window: how many days of news are collected and listed.
  const [windowDays, setWindowDays] = useState(3);
  const [savingWindow, setSavingWindow] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ place, limit: String(limit) });
      const res = await fetch(`/api/admin/news/stories?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load stories.");
      setStories(data.stories);
      setTotal(data.total);
      if (data.funnel?.windowDays) setWindowDays(data.funnel.windowDays);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place, limit, tick]);

  useEffect(() => {
    load();
  }, [load]);

  async function changeWindow(days: number) {
    setSavingWindow(true);
    try {
      const res = await fetch("/api/admin/news/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collectDays: days }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not save.");
      setWindowDays(days);
      toast.success(`Showing news from the last ${days === 1 ? "24 hours" : `${days} days`}. Fetch latest news to fill in older items.`);
      setTick((t) => t + 1);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSavingWindow(false);
    }
  }

  const windowLabel = windowDays === 1 ? "24 hours" : `${windowDays} days`;

  async function fetchLatest() {
    setFetching(true);
    try {
      const res = await fetch("/api/admin/news/fetch", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Fetch failed.");
      const s = data.summary;
      if (s.sourcesChecked === 0) toast.error("No active sources. Add some under Settings → Sources.");
      else toast.success(s.itemsNew ? `${s.itemsNew} new article(s) collected.` : "Up to date: nothing new since the last fetch.");
      setLastFetch(new Date().toISOString());
      setTick((n) => n + 1);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setFetching(false);
    }
  }

  async function findPlace(e: React.FormEvent) {
    e.preventDefault();
    const name = placeInput.trim();
    if (!name) return;
    setPlace(name);
    setLimit(PAGE);
    if (!canEdit) return;
    setFetching(true);
    try {
      const res = await fetch("/api/admin/news/place-search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ place: name }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed.");
      setTick((n) => n + 1);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setFetching(false);
    }
  }

  function clearPlace() {
    setPlace("");
    setPlaceInput("");
    setLimit(PAGE);
  }

  async function generate(id: string) {
    setGenerating({ id, text: "Starting…" });
    try {
      const r = await generateNewsArticle(id, (text) => setGenerating({ id, text }));
      toast.success(`Draft ready (${r.wordCount} words).`);
      window.location.href = r.adminUrl;
    } catch (e: any) {
      toast.error(e.message || "Generation failed.");
      setGenerating(null);
      setTick((n) => n + 1);
    }
  }

  async function ignore(id: string) {
    setStories((prev) => prev.filter((s) => s.id !== id));
    setTotal((n) => Math.max(0, n - 1));
    await fetch("/api/admin/news/stories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "status", id, status: "ignored" }) }).catch(() => {});
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-ink-900">Trending News</h1>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-ink-600">
            Travel news from the last
            {canEdit ? (
              <select
                aria-label="How far back to collect and list news"
                value={windowDays}
                disabled={savingWindow}
                onChange={(e) => changeWindow(Number(e.target.value))}
                className="rounded-md border border-ink-200 bg-white px-1.5 py-0.5 text-sm font-semibold text-ink-900 disabled:opacity-60"
              >
                {[1, 2, 3, 7, 14].map((d) => (
                  <option key={d} value={d}>
                    {d === 1 ? "24 hours" : `${d} days`}
                  </option>
                ))}
              </select>
            ) : (
              <span className="font-semibold text-ink-900">{windowLabel}</span>
            )}
            . Generate an article, review it, then publish.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <details className="relative">
            <summary className="cursor-pointer list-none rounded-lg px-3 py-2 text-sm text-ink-600 hover:bg-ink-50 hover:text-ink-900">Settings</summary>
            <div className="absolute right-0 z-10 mt-1 w-44 rounded-lg border border-ink-200 bg-white py-1 text-sm shadow-lg">
              <Link href="/admin/news/automation" className="block px-3 py-2 hover:bg-ink-50">Automation</Link>
              <Link href="/admin/news/sources" className="block px-3 py-2 hover:bg-ink-50">Sources</Link>
              <Link href="/admin/news/filter" className="block px-3 py-2 hover:bg-ink-50">Filter</Link>
              <Link href="/admin/activity?scope=news" className="block px-3 py-2 hover:bg-ink-50">Publish log</Link>
            </div>
          </details>
          {canEdit && (
            <button onClick={fetchLatest} disabled={fetching} className="rounded-lg bg-[#DC2626] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#B91C1C] disabled:opacity-60">
              {fetching ? "Fetching…" : "Fetch latest news"}
            </button>
          )}
        </div>
      </div>

      <form onSubmit={findPlace} className="flex gap-2">
        <input
          className="min-w-0 flex-1 rounded-lg border border-ink-200 bg-white px-4 py-2.5 text-sm focus:border-ink-400 focus:outline-none"
          placeholder="Find news for a city or country: Barcelona, Bali, Italy…"
          value={placeInput}
          onChange={(e) => setPlaceInput(e.target.value)}
          aria-label="City or country"
        />
        <button type="submit" disabled={fetching || !placeInput.trim()} className="rounded-lg border border-ink-200 bg-white px-4 py-2.5 text-sm font-medium text-ink-800 hover:bg-ink-50 disabled:opacity-60">
          Search
        </button>
      </form>

      <div className="flex items-center justify-between text-sm text-ink-500">
        <span>
          {place ? (
            <>
              {total} {total === 1 ? "story" : "stories"} for <b className="text-ink-900">{place}</b>{" "}
              <button onClick={clearPlace} className="ml-1 underline hover:text-ink-900">Show all</button>
            </>
          ) : (
            <>{total} {total === 1 ? "story" : "stories"}, best first</>
          )}
        </span>
        <span>{lastFetch ? `Last fetched ${ago(lastFetch)}` : ""}</span>
      </div>

      <ul className="divide-y divide-ink-100 rounded-xl border border-ink-200 bg-white">
        {loading && stories.length === 0 && <li className="p-6 text-sm text-ink-500">Loading…</li>}
        {!loading && stories.length === 0 && (
          <li className="p-6 text-sm text-ink-500">
            {place ? `No news for ${place} in the last ${windowLabel}.` : "No fresh news yet. Click Fetch latest news."}
          </li>
        )}
        {stories.map((s, i) => {
          const st = stateOf(s);
          const score = s.trendScore == null ? null : Math.round(s.trendScore);
          const tier = s.trendBreakdown?.tier;
          const scoreCls = tier === "high" ? "bg-emerald-600 text-white" : tier === "review" ? "bg-amber-100 text-amber-900" : "bg-ink-100 text-ink-600";
          const busy = generating?.id === s.id;
          const link = s.items[0]?.url;
          return (
            <li key={s.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 w-8 shrink-0 text-sm font-semibold tabular-nums text-ink-400">#{i + 1}</span>
                  {score != null && (
                    <span title="Trend score (0-100)" className={`mt-0.5 shrink-0 rounded px-2 py-0.5 text-xs font-bold tabular-nums ${scoreCls}`}>{score}</span>
                  )}
                  <span className={`mt-0.5 shrink-0 rounded px-2 py-0.5 text-xs font-medium ${st.cls}`}>{st.label}</span>
                  {link ? (
                    <a href={link} target="_blank" rel="noopener noreferrer nofollow" className="font-medium leading-snug text-ink-900 hover:underline">{s.title}</a>
                  ) : (
                    <span className="font-medium leading-snug text-ink-900">{s.title}</span>
                  )}
                </div>
                <p className="mt-1 pl-10 text-xs text-ink-500">
                  {[s.category, `${s.sourceCount} ${s.sourceCount === 1 ? "source" : "sources"}`, ago(s.lastSeenAt)].filter(Boolean).join(" · ")}
                </p>
                {busy && <p className="mt-1 pl-10 text-xs font-medium text-blue-700">{generating!.text}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {st.action === "generate" && canEdit && (
                  <>
                    <button
                      onClick={() => generate(s.id)}
                      disabled={!!generating}
                      className="rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white hover:bg-ink-700 disabled:opacity-50"
                    >
                      {busy ? "Generating…" : "Generate article"}
                    </button>
                    <button onClick={() => ignore(s.id)} disabled={!!generating} title="Hide this story" className="rounded-lg px-2 py-2 text-sm text-ink-400 hover:bg-ink-50 hover:text-ink-700">
                      Hide
                    </button>
                  </>
                )}
                {st.action === "open" && s.pipeline.articleId && (
                  <Link href={`/admin/articles/${s.pipeline.articleId}`} className="rounded-lg border border-ink-200 px-4 py-2 text-sm font-medium text-ink-800 hover:bg-ink-50">
                    Open draft
                  </Link>
                )}
                {st.action === "view" && s.pipeline.articleId && (
                  <Link href={`/admin/articles/${s.pipeline.articleId}`} className="rounded-lg px-4 py-2 text-sm text-ink-600 hover:bg-ink-50">
                    View
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {stories.length < total && (
        <div className="text-center">
          <button onClick={() => setLimit((n) => n + PAGE)} disabled={loading} className="rounded-lg border border-ink-200 bg-white px-5 py-2 text-sm text-ink-700 hover:bg-ink-50 disabled:opacity-60">
            {loading ? "Loading…" : "Show more"}
          </button>
        </div>
      )}
    </div>
  );
}
