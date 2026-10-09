"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface Config {
  enabled: boolean;
  dailyTarget: number;
  minScore: number;
  maxAgeHours: number;
  draft: boolean;
  image: boolean;
  inlinePhotos: boolean;
  minQuality: number;
}
interface Job {
  id: number;
  kind: string;
  status: string;
  attempts: number;
  maxAttempts: number;
  runAfter: string;
  error: string;
  createdAt: string;
  articleId: string | null;
  title: string;
}

const STATUS_STYLE: Record<string, string> = {
  queued: "bg-slate-100 text-slate-700",
  running: "bg-blue-100 text-blue-700",
  done: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  cancelled: "bg-slate-100 text-slate-400",
};

function ago(iso: string) {
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.round(m / 60)}h ago`;
  return `${Math.round(m / 1440)}d ago`;
}

export default function NewsAutomation({ canEdit }: { canEdit: boolean }) {
  const [config, setConfig] = useState<Config | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [eligible, setEligible] = useState<number | null>(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/news/jobs");
    const d = await res.json().catch(() => ({}));
    if (res.ok) {
      setConfig(d.config);
      setJobs(d.jobs);
      setStats(d.stats);
      setEligible(typeof d.eligible === "number" ? d.eligible : null);
    } else setMsg(d.error || "Couldn't load.");
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function act(action: string, extra: Record<string, unknown> = {}, label = action) {
    setBusy(label);
    setMsg("");
    const res = await fetch("/api/admin/news/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) setMsg(d.detail || d.error || "Failed.");
    else if (action === "enqueue") setMsg(`Queued ${d.queued} ${d.queued === 1 ? "story" : "stories"} (${d.remaining} slots left today).`);
    else if (action === "run") setMsg(`Ran ${d.processed} job(s): ${d.done} done, ${d.retried} retrying, ${d.failed} failed.`);
    if (res.ok && action === "settings") setConfig(d.config);
    await load();
    setBusy("");
  }

  if (!config) return <div className="p-6 text-sm text-ink-600">{msg || "Loading…"}</div>;
  const field = "w-24 rounded-lg border border-ink-200 bg-white px-2 py-1 text-sm";
  const set = (patch: Partial<Config>) => setConfig({ ...config, ...patch });

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Automation</h1>
          <p className="mt-1 text-sm text-ink-600">
            Picks the top stories, researches them, drafts the article and generates a cover. Drafts wait in{" "}
            <Link href="/admin/articles" className="underline">Articles</Link> as Pending Review. Nothing is published automatically.
          </p>
        </div>
        <Link href="/admin/news" className="rounded-lg border border-ink-200 bg-white px-4 py-2 text-sm font-medium text-ink-800 hover:bg-ink-50">
          Back to Trending News
        </Link>
      </div>

      <div className="rounded-xl border border-ink-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-ink-900">
            <input type="checkbox" checked={config.enabled} disabled={!canEdit} onChange={(e) => set({ enabled: e.target.checked })} />
            Automation on
          </label>
          <label className="flex items-center gap-2 text-sm text-ink-700">Stories per day
            <input type="number" min={1} max={30} className={field} value={config.dailyTarget} disabled={!canEdit} onChange={(e) => set({ dailyTarget: Number(e.target.value) })} />
          </label>
          <label className="flex items-center gap-2 text-sm text-ink-700" title="Trend score a story needs. Typical scores today: top story about 65–70, review tier 55+.">Min score
            <input type="number" min={0} max={100} className={field} value={config.minScore} disabled={!canEdit} onChange={(e) => set({ minScore: Number(e.target.value) })} />
          </label>
          <label className="flex items-center gap-2 text-sm text-ink-700">Max age (hours)
            <input type="number" min={6} max={168} className={field} value={config.maxAgeHours} disabled={!canEdit} onChange={(e) => set({ maxAgeHours: Number(e.target.value) })} />
          </label>
          <label className="flex items-center gap-2 text-sm text-ink-700" title="A news article can only be published once its quality score reaches this number (0 turns the requirement off).">Min quality to publish
            <input type="number" min={0} max={100} className={field} value={config.minQuality} disabled={!canEdit} onChange={(e) => set({ minQuality: Number(e.target.value) })} />
          </label>
          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input type="checkbox" checked={config.draft} disabled={!canEdit} onChange={(e) => set({ draft: e.target.checked })} /> Create draft
          </label>
          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input type="checkbox" checked={config.image} disabled={!canEdit} onChange={(e) => set({ image: e.target.checked })} /> AI cover
          </label>
          <label className="flex items-center gap-2 text-sm text-ink-700" title="Free-licence photos between paragraphs, only in stories of 350+ words">
            <input type="checkbox" checked={config.inlinePhotos !== false} disabled={!canEdit} onChange={(e) => set({ inlinePhotos: e.target.checked })} /> Photos inside long stories
          </label>
        </div>
        <p className="mt-3 text-xs text-ink-600">
          Stories that qualify right now (travel-relevant, at or above the min score, seen within the max age, not yet started):{" "}
          <b className="text-ink-900">{eligible ?? "…"}</b>. Save settings to refresh this count.
        </p>
        {canEdit && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button onClick={() => act("settings", config as unknown as Record<string, unknown>, "save")} disabled={!!busy} className="rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
              {busy === "save" ? "Saving…" : "Save settings"}
            </button>
            <button onClick={() => act("enqueue")} disabled={!!busy} className="rounded-lg border border-ink-200 bg-white px-4 py-2 text-sm font-medium text-ink-800 disabled:opacity-60">
              {busy === "enqueue" ? "Queuing…" : "Queue top stories now"}
            </button>
            <button onClick={() => act("run")} disabled={!!busy} className="rounded-lg border border-ink-200 bg-white px-4 py-2 text-sm font-medium text-ink-800 disabled:opacity-60">
              {busy === "run" ? "Running… (up to a minute)" : "Run queue now"}
            </button>
            {msg && <span className="text-sm text-ink-700">{msg}</span>}
          </div>
        )}
        <p className="mt-3 text-xs text-ink-500">
          Last 7 days: {["queued", "running", "done", "failed"].map((k) => `${stats[k] || 0} ${k}`).join(" · ")}. The queue is worked every 10 minutes by cron.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-ink-200 bg-white">
        {jobs.length === 0 ? (
          <div className="p-8 text-center text-sm text-ink-600">No jobs yet. Turn automation on, or click “Queue top stories now”.</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-ink-50 text-xs uppercase text-ink-500">
              <tr>
                <th className="px-4 py-2">Step</th>
                <th className="px-4 py-2">Story</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">When</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id} className="border-t border-ink-100 align-top">
                  <td className="px-4 py-2 font-medium capitalize">{j.kind}</td>
                  <td className="max-w-md px-4 py-2">
                    <div className="truncate">{j.title || j.id}</div>
                    {j.error && <div className="mt-0.5 text-xs text-red-600">{j.error}</div>}
                    {j.articleId && j.status === "done" && j.kind === "draft" && (
                      <Link href={`/admin/articles/${j.articleId}`} className="text-xs underline">Open draft</Link>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[j.status] || ""}`}>{j.status}</span>
                    <span className="ml-1 text-xs text-ink-500">{j.attempts}/{j.maxAttempts}</span>
                  </td>
                  <td className="px-4 py-2 text-xs text-ink-500">{ago(j.createdAt)}</td>
                  <td className="px-4 py-2 text-right">
                    {canEdit && j.status === "failed" && <button onClick={() => act("retry", { id: j.id })} className="mr-2 text-xs underline">Retry</button>}
                    {canEdit && (j.status === "failed" || j.status === "queued") && <button onClick={() => act("cancel", { id: j.id })} className="text-xs underline">Cancel</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
