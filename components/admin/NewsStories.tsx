"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ToastProvider";
import { useConfirm } from "@/components/ConfirmProvider";
import type { Story, StoryFunnel } from "@/lib/news/stories";
import NewsResearchPanel from "@/components/admin/NewsResearchPanel";
import Link from "next/link";
import type { Calibration } from "@/lib/news/decisions";
import { generateNewsArticle } from "@/lib/news/clientPipeline";
import { STAGE_GROUPS, type StepState, type StoryPipeline } from "@/lib/news/stage";

const TONE: Record<StoryPipeline["tone"], string> = {
  neutral: "bg-ink-100 text-ink-700",
  progress: "bg-blue-100 text-blue-800",
  attention: "bg-amber-100 text-amber-900",
  good: "bg-emerald-600 text-white",
  done: "bg-ink-900 text-white",
};

const STEP_STYLE: Record<StepState, { cls: string; mark: string; word: string }> = {
  todo: { cls: "border-ink-200 text-ink-400", mark: "○", word: "not yet" },
  running: { cls: "border-blue-300 bg-blue-50 text-blue-700", mark: "…", word: "in progress" },
  done: { cls: "border-emerald-300 bg-emerald-50 text-emerald-800", mark: "✓", word: "done" },
  warn: { cls: "border-amber-300 bg-amber-50 text-amber-800", mark: "!", word: "needs attention" },
  failed: { cls: "border-red-300 bg-red-50 text-red-700", mark: "✗", word: "failed" },
};

function StepChips({ steps }: { steps: StoryPipeline["steps"] }) {
  const list: [string, StepState][] = [
    ["Research", steps.research],
    ["Draft", steps.draft],
    ["Fact check", steps.factCheck],
    ["Image", steps.image],
    ["Published", steps.published],
  ];
  return (
    <span className="inline-flex flex-wrap gap-1">
      {list.map(([label, st]) => (
        <span key={label} title={`${label}: ${STEP_STYLE[st].word}`} className={`rounded border px-1.5 py-0.5 text-[11px] font-medium ${STEP_STYLE[st].cls}`}>
          {STEP_STYLE[st].mark} {label}
        </span>
      ))}
    </span>
  );
}

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
  // Destination search: the place being shown, and what's typed in the box.
  const [place, setPlace] = useState("");
  const [placeInput, setPlaceInput] = useState("");
  const [searching, setSearching] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
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
  const [calibration, setCalibration] = useState<Calibration | null>(null);
  const [stageFilter, setStageFilter] = useState("");
  const [generating, setGenerating] = useState<{ id: string; text: string } | null>(null);

  // Research -> write -> fact check -> image -> quality, then open the editor.
  async function generate(id: string) {
    setGenerating({ id, text: "Starting…" });
    try {
      const r = await generateNewsArticle(id, (text) => setGenerating({ id, text }));
      toast.success(`Draft created (${r.wordCount} words, fact check ${r.verdict.replace("_", " ")}, quality ${r.quality.score}/100).`);
      window.location.href = r.adminUrl;
    } catch (e: any) {
      toast.error(e.message || "Generation failed.");
      setGenerating(null);
      load();
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ q, place, category, minSources: String(minSources), limit: String(showAll || q || place ? 100 : 10) });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, place, category, minSources, showAll, toast, reloadTick]);

  // Shows stored stories for the place at once, then asks Google News for
  // anything newer (last 24 hours) and reloads.
  async function findPlace(e?: React.FormEvent) {
    e?.preventDefault();
    const name = placeInput.trim();
    if (!name) return;
    setPlace(name);
    if (!canEdit) return;
    setSearching(true);
    try {
      const res = await fetch("/api/admin/news/place-search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ place: name }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed.");
      if (data.error) toast.error(`Google News: ${data.error}`);
      else toast.success(`${data.place}: ${data.found} fresh article(s) found, ${data.added} new.`);
      setReloadTick((n) => n + 1); // reload with the new place filter
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSearching(false);
    }
  }

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
      toast.success(`${r.assigned} items grouped: ${r.newClusters} new stories, ${r.joinedExisting} joined existing${r.merged ? `, ${r.merged} duplicate ${r.merged === 1 ? "story" : "stories"} merged` : ""}.`);
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  const loadSettings = useCallback(async () => {
    const res = await fetch("/api/admin/news/settings");
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setCfg(data.trend);
      setCalibration(data.calibration || null);
    } else toast.error(data.error || "Could not load settings.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Thresholds drive the score filter, so load them with the page.
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  async function openSettings() {
    setShowSettings((v) => !v);
    if (!showSettings) await loadSettings();
  }

  async function saveSettings(reset = false) {
    setBusy(true);
    try {
      const body = reset
        ? { reset: true }
        : { weights: cfg.weights, thresholds: cfg.thresholds, freshnessBands: cfg.freshnessBands, staleScore: cfg.staleScore, sourceCurve: cfg.sourceCurve };
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

  async function postStories(body: Record<string, unknown>): Promise<any> {
    const res = await fetch("/api/admin/news/stories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error || "Request failed.");
    return d;
  }

  // Editor merge: everything in `sourceId` joins `targetId`.
  async function mergeStory(source: Story, targetId: string) {
    const target = stories.find((x) => x.id === targetId);
    const ok = await confirm({
      title: "Merge these stories?",
      description: `“${source.title.slice(0, 90)}” and its ${source.itemCount} item(s) join “${(target?.title || "").slice(0, 90)}”.`,
      confirmLabel: "Merge",
    });
    if (!ok) return;
    try {
      await postStories({ action: "merge", targetId, ids: [source.id] });
      toast.success("Stories merged.");
      await load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  // Editor split/move: one item to another story, or to a new story ("").
  async function moveStoryItem(itemId: string, targetId: string) {
    try {
      await postStories({ action: "move", itemId, targetId: targetId || null });
      toast.success(targetId ? "Item moved." : "Item split into a new story. The two won't be merged again automatically.");
      await load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function setStatus(id: string, status: string) {
    const res = await fetch("/api/admin/news/stories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "status", id, status }) });
    if (!res.ok) return toast.error("Could not update story.");
    setStories((cur) => (status === "ignored" ? cur.filter((s) => s.id !== id) : cur.map((s) => (s.id === id ? { ...s, status } : s))));
  }

  const shown = stories.filter(
    (s) => (s.trendScore ?? 0) >= minScore && (!stageFilter || STAGE_GROUPS[stageFilter]?.includes(s.pipeline.stage))
  );
  const shownCount = shown.length;
  const input = "rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 focus:border-ink-400 focus:outline-none";

  return (
    <div>
      {funnel && (
        <div className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-ink-200 bg-white px-4 py-3 text-sm text-ink-700">
          <span><b className="text-ink-900">{funnel.itemsCollected}</b> items collected (last {funnel.windowDays === 1 ? "24 hours" : `${funnel.windowDays} days`})</span>
          <span aria-hidden>→</span>
          <span><b className="text-ink-900">{funnel.itemsCollected - funnel.itemsTravel}</b> non-travel removed</span>
          <span aria-hidden>→</span>
          <span><b className="text-ink-900">{funnel.itemsTravel}</b> travel-related (score 60+)</span>
          <span aria-hidden>→</span>
          <span><b className="text-ink-900">{funnel.storiesTravel}</b> travel stories</span>
          <span aria-hidden>→</span>
          <span className="rounded bg-emerald-600 px-2 py-0.5 font-semibold text-white">{showAll || q || place ? `showing ${shownCount}` : "top 10 by score"}</span>
          <button onClick={() => setShowAll((v) => !v)} className="ml-auto text-xs font-medium text-ink-600 underline hover:text-ink-900">
            {showAll ? "Show top 10 only" : `Show all ${funnel.storiesTravel} travel stories`}
          </button>
        </div>
      )}
      <form onSubmit={findPlace} className="flex flex-wrap items-center gap-2 rounded-xl border border-ink-200 bg-white p-3">
        <label htmlFor="place-search" className="text-sm font-semibold text-ink-900">Destination</label>
        <input
          id="place-search"
          className={`${input} w-72`}
          placeholder="City or country: Barcelona, Bali, New Delhi, Italy"
          value={placeInput}
          onChange={(e) => setPlaceInput(e.target.value)}
        />
        <button type="submit" disabled={searching || !placeInput.trim()} className="rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white hover:bg-ink-700 disabled:opacity-60">
          {searching ? "Searching…" : "Find news"}
        </button>
        {place ? (
          <span className="flex items-center gap-2 text-sm text-ink-600">
            Fresh news for <b className="text-ink-900">{place}</b> (last 24 hours): {total} {total === 1 ? "story" : "stories"}
            <button type="button" onClick={() => { setPlace(""); setPlaceInput(""); }} className="text-xs underline hover:text-ink-900">Clear</button>
          </span>
        ) : (
          <span className="text-xs text-ink-500">Shows only stories from the last 24 hours whose sources can be read, and fetches new ones from Google News.</span>
        )}
      </form>
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
          <option value={cfg?.thresholds?.review ?? 50}>Review tier ({cfg?.thresholds?.review ?? 50}+)</option>
          <option value={cfg?.thresholds?.high ?? 60}>High priority ({cfg?.thresholds?.high ?? 60}+)</option>
        </select>
        <select className={input} value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} title="Where the story is in the pipeline">
          <option value="">Any stage</option>
          <option value="todo">Not started</option>
          <option value="progress">In progress</option>
          <option value="attention">Needs attention</option>
          <option value="ready">Ready for review</option>
          <option value="done">Published or scheduled</option>
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
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <div>
              <div className="text-sm font-medium text-ink-900">Freshness</div>
              <p className="text-xs text-ink-500">Score by the age of the story&apos;s newest item.</p>
              <table className="mt-2 text-sm">
                <tbody>
                  {(cfg.freshnessBands as [number, number][]).map(([h, v], i) => (
                    <tr key={i}>
                      <td className="pr-2 text-ink-600">Up to</td>
                      <td className="pr-2">
                        <input type="number" min={1} disabled={!canEdit} className={`${input} w-20`} value={h}
                          onChange={(e) => setCfg({ ...cfg, freshnessBands: cfg.freshnessBands.map((b: [number, number], j: number) => (j === i ? [Number(e.target.value), b[1]] : b)) })} />
                      </td>
                      <td className="pr-2 text-ink-600">hours →</td>
                      <td>
                        <input type="number" min={0} max={100} disabled={!canEdit} className={`${input} w-20`} value={v}
                          onChange={(e) => setCfg({ ...cfg, freshnessBands: cfg.freshnessBands.map((b: [number, number], j: number) => (j === i ? [b[0], Number(e.target.value)] : b)) })} />
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td className="pr-2 text-ink-600" colSpan={3}>Older →</td>
                    <td>
                      <input type="number" min={0} max={100} disabled={!canEdit} className={`${input} w-20`} value={cfg.staleScore}
                        onChange={(e) => setCfg({ ...cfg, staleScore: Number(e.target.value) })} />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div>
              <div className="text-sm font-medium text-ink-900">Source count</div>
              <p className="text-xs text-ink-500">Score by how many different publishers report the story.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(cfg.sourceCurve as number[]).map((v, i) => (
                  <label key={i} className="text-xs text-ink-600">
                    <span className="block">{i === 4 ? "5+" : i + 1}</span>
                    <input type="number" min={0} max={100} disabled={!canEdit} className={`${input} w-16`} value={v}
                      onChange={(e) => setCfg({ ...cfg, sourceCurve: cfg.sourceCurve.map((x: number, j: number) => (j === i ? Number(e.target.value) : x)) })} />
                  </label>
                ))}
              </div>
            </div>
          </div>
          {calibration && (
            <div className="mt-5 rounded-lg border border-ink-200 bg-ink-50 p-4 text-sm">
              <div className="font-medium text-ink-900">Calibration: your picks against the score (last {calibration.days} days)</div>
              <p className="mt-1 text-ink-700">
                {calibration.picks} {calibration.picks === 1 ? "story" : "stories"} picked (shortlisted, generated or published), {calibration.ignored} ignored
                {calibration.autoDrafted ? `, ${calibration.autoDrafted} drafted by automation` : ""}.
                {calibration.topShare !== null && (
                  <>
                    {" "}
                    <b className={calibration.topShare >= 0.7 ? "text-green-700" : "text-amber-700"}>
                      {calibration.picksInTop} of {calibration.picks} ({Math.round(calibration.topShare * 100)}%)
                    </b>{" "}
                    were in the score&apos;s top 15 when you picked them (target: 70%).
                  </>
                )}
              </p>
              {calibration.pickScore && (
                <p className="mt-1 text-xs text-ink-600">
                  Your picks scored {calibration.pickScore.p20}+ (four in five) with a median of {calibration.pickScore.median}
                  {calibration.ignoredMedian !== null ? `; ignored stories had a median of ${calibration.ignoredMedian}` : ""}.
                </p>
              )}
              <p className="mt-1 text-xs text-ink-500">{calibration.note}</p>
              {calibration.suggested && canEdit && (
                <button
                  onClick={() => setCfg({ ...cfg, thresholds: { high: calibration.suggested!.high, review: calibration.suggested!.review } })}
                  className="mt-2 rounded border border-ink-300 bg-white px-3 py-1 text-xs hover:bg-ink-50"
                >
                  Use suggested thresholds: high {calibration.suggested.high}, review {calibration.suggested.review} (then save)
                </button>
              )}
            </div>
          )}
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
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className={`rounded px-2 py-0.5 text-xs font-semibold ${TONE[s.pipeline.tone]}`}>{s.pipeline.label}</span>
                        <StepChips steps={s.pipeline.steps} />
                        {generating?.id === s.id && <span className="text-xs font-medium text-blue-700">{generating.text}</span>}
                      </div>
                      {s.relevanceReason && <p className="mt-1 text-xs text-ink-500">Why: {s.relevanceReason}</p>}
                    </div>
                    {canEdit && (
                      <div className="flex shrink-0 flex-col gap-1">
                        {s.pipeline.articleId ? (
                          <Link href={`/admin/articles/${s.pipeline.articleId}`} className="rounded bg-ink-900 px-2.5 py-1 text-center text-xs font-medium text-white hover:bg-ink-800">
                            Open draft
                          </Link>
                        ) : (
                          <button
                            onClick={() => generate(s.id)}
                            disabled={!!generating || s.pipeline.stage === "researching" || s.pipeline.stage === "writing"}
                            className="rounded bg-[#DC2626] px-2.5 py-1 text-xs font-medium text-white hover:bg-[#B91C1C] disabled:opacity-50"
                            title="Research, write, fact-check and illustrate this story (about 2 minutes)"
                          >
                            {generating?.id === s.id ? "Generating…" : "Generate article"}
                          </button>
                        )}
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
                          {canEdit && (s.items.length > 1 || stories.length > 1) && (
                            <select
                              value="none"
                              onChange={(e) => e.target.value !== "none" && moveStoryItem(it.id, e.target.value === "new" ? "" : e.target.value)}
                              className="ml-2 max-w-[14rem] rounded border border-ink-200 bg-white px-1 py-0.5 text-xs text-ink-600"
                              aria-label="Move this item"
                            >
                              <option value="none">Move…</option>
                              {s.items.length > 1 && <option value="new">Split into a new story</option>}
                              {stories
                                .filter((o) => o.id !== s.id)
                                .slice(0, 60)
                                .map((o) => (
                                  <option key={o.id} value={o.id}>To: {o.title.slice(0, 70)}</option>
                                ))}
                            </select>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {isOpen && canEdit && stories.length > 1 && !s.pipeline.articleId && (
                    <div className="mt-2 flex items-center gap-2 pl-4 text-xs text-ink-600">
                      <span>Same event as another story?</span>
                      <select
                        value="none"
                        onChange={(e) => e.target.value !== "none" && mergeStory(s, e.target.value)}
                        className="max-w-md rounded border border-ink-200 bg-white px-1 py-0.5 text-xs"
                        aria-label="Merge this story into another"
                      >
                        <option value="none">Merge into…</option>
                        {stories
                          .filter((o) => o.id !== s.id)
                          .slice(0, 60)
                          .map((o) => (
                            <option key={o.id} value={o.id}>{o.title.slice(0, 80)}</option>
                          ))}
                      </select>
                    </div>
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
