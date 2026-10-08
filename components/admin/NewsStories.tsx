"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ToastProvider";
import { useConfirm } from "@/components/ConfirmProvider";
import type { Story, StoryFunnel } from "@/lib/news/stories";
import NewsResearchPanel from "@/components/admin/NewsResearchPanel";

function band(n: number): { label: string; cls: string } {
  if (n >= 90) return { label: "Extremely relevant", cls: "bg-emerald-600 text-white" };
  if (n >= 75) return { label: "Highly relevant", cls: "bg-emerald-100 text-emerald-800" };
  return { label: "Relevant", cls: "bg-sky-100 text-sky-800" };
}

function ago(iso: string | null): string {
  if (!iso) return "—";
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

export default function NewsStories({ categories, canEdit }: { categories: string[]; canEdit: boolean }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [stories, setStories] = useState<Story[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [minSources, setMinSources] = useState(1);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [minScore, setMinScore] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [funnel, setFunnel] = useState<StoryFunnel | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [cfg, setCfg] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ q, category, minSources: String(minSources), limit: String(showAll || q ? 100 : 10) });
      const res = await fetch(`/api/admin/news/stories?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load stories.");
      setStories(data.stories);
      setTotal(data.total);
      setFunnel(data.funnel || null);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [q, category, minSources, showAll, toast]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  async function run(action: "cluster" | "rebuild") {
    if (action === "rebuild") {
      const ok = await confirm({
        title: "Rebuild all story groupings?",
        description: "Clears every cluster and groups the last 3 days of items again from scratch. Shortlist/ignore marks on stories are lost.",
        confirmLabel: "Rebuild",
        danger: true,
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/news/stories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed.");
      const r = data.result;
      toast.success(`${r.assigned} items grouped: ${r.newClusters} new stories, ${r.joinedExisting} joined existing.`);
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function openSettings() {
    setShowSettings((v) => !v);
    if (!cfg) {
      const res = await fetch("/api/admin/news/settings");
      const data = await res.json();
      if (res.ok) setCfg(data.trend);
      else toast.error(data.error || "Could not load settings.");
    }
  }

  async function saveSettings(reset = false) {
    setBusy(true);
    try {
      const body = reset ? { reset: true } : { weights: cfg.weights, thresholds: cfg.thresholds };
      const res = await fetch("/api/admin/news/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save.");
      setCfg(data.trend);
      toast.success(`Saved. ${data.scored} stories re-scored.`);
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function rescore() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/news/stories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "score" }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed.");
      toast.success(`${data.scored} stories scored.`);
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(id: string, status: string) {
    const res = await fetch("/api/admin/news/stories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "status", id, status }) });
    if (!res.ok) return toast.error("Could not update story.");
    setStories((cur) => (status === "ignored" ? cur.filter((s) => s.id !== id) : cur.map((s) => (s.id === id ? { ...s, status } : s))));
  }

  const shown = stories.filter((s) => (s.trendScore ?? 0) >= minScore);
  const shownCount = shown.length;
  const input = "rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 focus:border-ink-400 focus:outline-none";

  return (
    <div>
      {funnel && (
        <div className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-ink-200 bg-white px-4 py-3 text-sm text-ink-700">
          <span><b className="text-ink-900">{funnel.itemsCollected}</b> items collected (last {funnel.windowDays} days)</span>
          <span aria-hidden>→</span>
          <span><b className="text-ink-900">{funnel.itemsCollected - funnel.itemsTravel}</b> non-travel removed</span>
          <span aria-hidden>→</span>
          <span><b className="text-ink-900">{funnel.itemsTravel}</b> travel-related (score 60+)</span>
          <span aria-hidden>→</span>
          <span><b className="text-ink-900">{funnel.storiesTravel}</b> travel stories</span>
          <span aria-hidden>→</span>
          <span className="rounded bg-emerald-600 px-2 py-0.5 font-semibold text-white">{showAll || q ? `showing ${shownCount}` : "top 10 by score"}</span>
          <button onClick={() => setShowAll((v) => !v)} className="ml-auto text-xs font-medium text-ink-600 underline hover:text-ink-900">
            {showAll ? "Show top 10 only" : `Show all ${funnel.storiesTravel} travel stories`}
          </button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <input className={`${input} w-64`} placeholder="Search stories…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={input} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select className={input} value={minSources} onChange={(e) => setMinSources(Number(e.target.value))}>
          <option value={1}>Any number of sources</option>
          <option value={2}>2+ sources</option>
          <option value={3}>3+ sources</option>
        </select>
        <select className={input} value={minScore} onChange={(e) => setMinScore(Number(e.target.value))}>
          <option value={0}>Any score</option>
          <option value={55}>Review tier (55+)</option>
          <option value={65}>High priority (65+)</option>
        </select>
        <button onClick={openSettings} className="rounded-lg border border-ink-200 bg-white px-4 py-2 text-sm hover:bg-ink-50">Scoring settings</button>
        {canEdit && (
          <div className="ml-auto flex gap-2">
            <button onClick={rescore} disabled={busy} className="rounded-lg border border-ink-200 bg-white px-4 py-2 text-sm hover:bg-ink-50 disabled:opacity-60">Re-score</button>
            <button onClick={() => run("cluster")} disabled={busy} className="rounded-lg border border-ink-200 bg-white px-4 py-2 text-sm hover:bg-ink-50 disabled:opacity-60">
              {busy ? "Working…" : "Group new items"}
            </button>
            <button onClick={() => run("rebuild")} disabled={busy} className="rounded-lg border border-ink-200 bg-white px-4 py-2 text-sm text-ink-600 hover:bg-ink-50 disabled:opacity-60">
              Rebuild
            </button>
          </div>
        )}
      </div>


      {showSettings && cfg && (
        <div className="mt-4 rounded-xl border border-ink-200 bg-white p-5">
          <h3 className="font-semibold text-ink-900">Scoring settings</h3>
          <p className="mt-1 text-xs text-ink-500">Weights are relative (they don&apos;t need to add up to 100). Saving re-scores every recent story.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {([
              ["freshness", "Freshness"],
              ["sources", "Source count"],
              ["impact", "Travel impact"],
              ["audience", "Audience relevance"],
              ["reliability", "Source reliability"],
              ["uniqueness", "Uniqueness"],
            ] as const).map(([k, label]) => (
              <label key={k} className="text-sm">
                <span className="text-ink-700">{label}</span>
                <input type="number" min={0} max={100} disabled={!canEdit} className={`${input} mt-1 w-full`} value={cfg.weights[k]} onChange={(e) => setCfg({ ...cfg, weights: { ...cfg.weights, [k]: Number(e.target.value) } })} />
              </label>
            ))}
            <label className="text-sm">
              <span className="text-ink-700">High-priority threshold</span>
              <input type="number" min={0} max={100} disabled={!canEdit} className={`${input} mt-1 w-full`} value={cfg.thresholds.high} onChange={(e) => setCfg({ ...cfg, thresholds: { ...cfg.thresholds, high: Number(e.target.value) } })} />
            </label>
            <label className="text-sm">
              <span className="text-ink-700">Review threshold</span>
              <input type="number" min={0} max={100} disabled={!canEdit} className={`${input} mt-1 w-full`} value={cfg.thresholds.review} onChange={(e) => setCfg({ ...cfg, thresholds: { ...cfg.thresholds, review: Number(e.target.value) } })} />
            </label>
          </div>
          {canEdit && (
            <div className="mt-4 flex gap-2">
              <button onClick={() => saveSettings(false)} disabled={busy} className="rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white hover:bg-ink-800 disabled:opacity-60">Save &amp; re-score</button>
              <button onClick={() => saveSettings(true)} disabled={busy} className="rounded-lg border border-ink-200 px-4 py-2 text-sm hover:bg-ink-50 disabled:opacity-60">Reset to defaults</button>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 overflow-hidden rounded-xl border border-ink-200 bg-white">
        {loading && stories.length === 0 ? (
          <div className="p-8 text-center text-sm text-ink-500">Loading…</div>
        ) : shown.length === 0 ? (
          <div className="p-8 text-center text-sm text-ink-600">No stories yet. Fetch news, then click “Group new items”.</div>
        ) : (
          <ul className="divide-y divide-ink-100">
            {shown.map((s, idx) => {
              const isOpen = open.has(s.id);
              return (
                <li key={s.id} className="p-4">
                  <div className="flex gap-4">
                    <div className="min-w-0 flex-1">
                      <span className="mr-2 text-sm font-bold text-ink-400">#{idx + 1}</span>
                      <button
                        onClick={() => setOpen((cur) => { const n = new Set(cur); n.has(s.id) ? n.delete(s.id) : n.add(s.id); return n; })}
                        className="text-left font-medium text-ink-900 hover:underline"
                      >
                        {s.title}
                      </button>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
                        {s.trendScore != null && (
                          <span
                            title={s.trendBreakdown ? s.trendBreakdown.notes.join(" · ") : ""}
                            className={`rounded px-2 py-0.5 text-sm font-bold ${s.trendBreakdown?.tier === "high" ? "bg-emerald-600 text-white" : s.trendBreakdown?.tier === "review" ? "bg-amber-400 text-ink-900" : "bg-ink-100 text-ink-600"}`}
                          >
                            {s.trendScore}
                          </span>
                        )}
                        {s.category && <span className="rounded bg-ink-100 px-1.5 py-0.5">{s.category}</span>}
                        <span title="Travel relevance of the best item (0–100). 60+ = travel news." className={`rounded px-1.5 py-0.5 font-medium ${band(s.relevance).cls}`}>
                          travel relevance {s.relevance} · {band(s.relevance).label}
                        </span>
                        <span className={`rounded px-1.5 py-0.5 ${s.sourceCount >= 3 ? "bg-emerald-100 text-emerald-800" : s.sourceCount === 2 ? "bg-sky-100 text-sky-800" : "bg-ink-100 text-ink-600"}`}>
                          {s.sourceCount} {s.sourceCount === 1 ? "source" : "sources"}
                        </span>
                        <span>{s.itemCount} {s.itemCount === 1 ? "item" : "items"}</span>
                        <span>first reported {ago(s.publishedFirstAt || s.firstSeenAt)}</span>
                        <span>updated {ago(s.lastSeenAt)}</span>
                        {s.status === "shortlisted" && <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-800">shortlisted</span>}
                        {s.researchStatus === "done" && <span className="rounded bg-sky-100 px-1.5 py-0.5 text-sky-800">researched</span>}
                        {s.researchStatus === "failed" && <span className="rounded bg-red-100 px-1.5 py-0.5 text-red-700">research failed</span>}
                      </div>
                      {s.relevanceReason && <p className="mt-1 text-xs text-ink-500">Why: {s.relevanceReason}</p>}
                    </div>
                    {canEdit && (
                      <div className="flex shrink-0 flex-col gap-1">
                        <button onClick={() => setStatus(s.id, s.status === "shortlisted" ? "new" : "shortlisted")} className="rounded border border-ink-200 px-2.5 py-1 text-xs hover:bg-ink-50">
                          {s.status === "shortlisted" ? "Unshortlist" : "Shortlist"}
                        </button>
                        <button onClick={() => setStatus(s.id, "ignored")} className="rounded border border-ink-200 px-2.5 py-1 text-xs hover:bg-ink-50">Ignore</button>
                      </div>
                    )}
                  </div>
                  {isOpen && (
                    <NewsResearchPanel
                      clusterId={s.id}
                      canEdit={canEdit}
                      initialStatus={s.researchStatus}
                      onStatus={(st) => setStories((cur) => cur.map((x) => (x.id === s.id ? { ...x, researchStatus: st } : x)))}
                    />
                  )}
                  {isOpen && s.trendBreakdown && (
                    <div className="mt-3 grid max-w-xl grid-cols-2 gap-x-6 gap-y-1 text-xs text-ink-600 md:grid-cols-3">
                      {([
                        ["Freshness", s.trendBreakdown.freshness],
                        ["Sources", s.trendBreakdown.sources],
                        ["Travel impact", s.trendBreakdown.impact],
                        ["Audience", s.trendBreakdown.audience],
                        ["Reliability", s.trendBreakdown.reliability],
                        ["Uniqueness", s.trendBreakdown.uniqueness],
                      ] as const).map(([label, v]) => (
                        <div key={label}>
                          <div className="flex justify-between"><span>{label}</span><span>{v}</span></div>
                          <div className="h-1.5 rounded bg-ink-100"><div className="h-1.5 rounded bg-ink-700" style={{ width: `${v}%` }} /></div>
                        </div>
                      ))}
                      <div className="col-span-full mt-1 text-ink-500">{s.trendBreakdown.notes.join(" · ")}</div>
                    </div>
                  )}
                  {isOpen && (
                    <ul className="mt-3 space-y-1.5 border-l-2 border-ink-100 pl-4">
                      {s.items.map((it) => (
                        <li key={it.id} className="text-sm">
                          <a href={it.url} target="_blank" rel="noopener noreferrer nofollow" className="text-ink-800 hover:underline">{it.title}</a>
                          <span className="ml-2 text-xs text-ink-500">{it.publisher} · reliability {it.reliabilityScore} · {ago(it.publishedAt)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <p className="mt-2 text-xs text-ink-500">{shown.length} of {total} travel stories shown, highest score first. Click a headline to see the sources behind it.</p>
    </div>
  );
}
