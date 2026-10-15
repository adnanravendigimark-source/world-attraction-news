"use client";

import { useState } from "react";
import Link from "next/link";
import { useToast } from "@/components/ToastProvider";
import { useConfirm } from "@/components/ConfirmProvider";
import type { NewsSource } from "@/lib/news/sources";
import type { FeedPreview } from "@/lib/news/collector";

interface Props {
  initialSources: NewsSource[];
  categories: string[];
  types: { value: string; label: string }[];
  keys: { newsapi: boolean; currents: boolean };
  canEdit: boolean;
}

const EMPTY = {
  name: "",
  type: "rss",
  rssUrl: "",
  url: "",
  query: "",
  category: "General",
  country: "",
  reliabilityScore: 50,
  fetchIntervalMinutes: 30,
  isActive: true,
  isOfficial: false,
  priority: 3,
};

const AGGREGATORS = ["google_news_rss", "newsapi", "currents"];

function ago(iso: string | null): string {
  if (!iso) return "never";
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

export default function NewsSourcesManager({ initialSources, categories, types, keys, canEdit }: Props) {
  const toast = useToast();
  const confirm = useConfirm();
  const [sources, setSources] = useState(initialSources);
  const [form, setForm] = useState<any>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<FeedPreview | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [filter, setFilter] = useState<"all" | "official" | "review">("all");

  const isApi = form.type === "newsapi" || form.type === "currents";
  const input = "w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 focus:border-ink-400 focus:outline-none";

  async function reload() {
    const res = await fetch("/api/admin/news/sources");
    const data = await res.json();
    if (res.ok) setSources(data.sources);
  }

  async function call(url: string, method: string, body?: unknown) {
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Request failed.");
    return data;
  }

  async function loadDefaults() {
    setBusy("defaults");
    try {
      const data = await call("/api/admin/news/sources", "POST", { loadDefaults: true });
      setSources(data.sources);
      toast.success(
        data.added
          ? `${data.added} source(s) added${data.official ? `, including ${data.official} official source(s) left inactive for you to review` : ""}.`
          : "All recommended sources are already present."
      );
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  }

  async function testFeed() {
    setBusy("preview");
    setPreview(null);
    setPreviewError("");
    try {
      const data = await call("/api/admin/news/sources", "POST", { testFeed: form.rssUrl, category: form.category, isOfficial: !!form.isOfficial });
      setPreview(data.preview);
    } catch (e: any) {
      setPreviewError(e.message);
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    setBusy("save");
    try {
      if (editingId) await call(`/api/admin/news/sources/${editingId}`, "PATCH", form);
      else await call("/api/admin/news/sources", "POST", form);
      toast.success(editingId ? "Source updated." : "Source added.");
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY);
      await reload();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  }

  async function toggle(s: NewsSource) {
    try {
      await call(`/api/admin/news/sources/${s.id}`, "PATCH", { isActive: !s.isActive });
      setSources((cur) => cur.map((x) => (x.id === s.id ? { ...x, isActive: !s.isActive } : x)));
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function remove(s: NewsSource) {
    const ok = await confirm({
      title: `Delete “${s.name}”?`,
      description: "This also deletes every item collected from this source.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await call(`/api/admin/news/sources/${s.id}`, "DELETE");
      setSources((cur) => cur.filter((x) => x.id !== s.id));
      toast.success("Source deleted.");
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function test(s: NewsSource) {
    setBusy(s.id);
    try {
      const data = await call("/api/admin/news/fetch", "POST", { sourceId: s.id });
      const r = data.summary.results[0];
      if (r?.status === "error") toast.error(`${s.name}: ${r.error}`);
      else toast.success(`${s.name}: ${r?.found ?? 0} found, ${r?.added ?? 0} new.`);
      await reload();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  }

  function edit(s: NewsSource) {
    setPreview(null);
    setPreviewError("");
    setForm({ ...s });
    setEditingId(s.id);
    setShowForm(true);
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin/news" className="text-xs text-ink-500 hover:underline">← Trending News</Link>
          <h1 className="mt-1 font-serif text-2xl font-bold text-ink-900">News Sources</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-600">
            Feeds and API queries the collector checks. Reliability (0–100) is your judgement of how much a source can be
            trusted. Official sources (a government, airline, airport or operator speaking for itself) count as confirmation
            in research and lift a story&apos;s reliability score. Google News and API results are leads only.
          </p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <button onClick={loadDefaults} disabled={busy === "defaults"} className="rounded-lg border border-ink-200 bg-white px-4 py-2 text-sm font-medium text-ink-800 hover:bg-ink-50 disabled:opacity-60">
              {busy === "defaults" ? "Loading…" : "Load recommended sources"}
            </button>
            <button
              onClick={() => {
                setPreview(null);
                setPreviewError("");
                setForm(EMPTY);
                setEditingId(null);
                setShowForm(true);
              }}
              className="rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white hover:bg-ink-800"
            >
              Add source
            </button>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        {/* NewsAPI and Currents are optional paid feeds. A missing key only
            matters when a source uses that provider. */}
        {(["newsapi", "currents"] as const).map((p) => {
          const label = p === "newsapi" ? "NewsAPI" : "Currents";
          const env = p === "newsapi" ? "NEWSAPI_KEY" : "CURRENTS_API_KEY";
          const used = sources.filter((s) => s.isActive && s.type === p).length;
          const set = keys[p];
          const tone = set ? "bg-emerald-100 text-emerald-800" : used > 0 ? "bg-red-100 text-red-800" : "bg-ink-100 text-ink-600";
          return (
            <span key={p} className={`rounded-full px-3 py-1 ${tone}`} title={set ? `${env} is set.` : `Add ${env} to the server settings to use ${label} sources.`}>
              {label}: {set ? "key set" : used > 0 ? `key missing (${env}), ${used} source${used === 1 ? "" : "s"} can't fetch` : "optional, not used"}
            </span>
          );
        })}
        {(() => {
          const official = sources.filter((s) => s.isOfficial);
          const on = official.filter((s) => s.isActive);
          const failing = on.filter((s) => s.lastStatus === "error").length;
          const off = official.length - on.length;
          return (
            <span className={`rounded-full px-3 py-1 ${failing ? "bg-red-50 text-red-800" : "bg-blue-50 text-blue-800"}`}>
              Official: {on.length - failing} working{failing ? `, ${failing} failing` : ""}
              {off ? `, ${off} switched off` : ""}
            </span>
          );
        })()}
        <span className="ml-auto flex gap-1">
          {(["all", "official", "review"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`rounded-full px-3 py-1 ${filter === f ? "bg-ink-900 text-white" : "bg-ink-100 text-ink-700"}`}>
              {f === "all" ? "All" : f === "official" ? "Official" : "To review"}
            </button>
          ))}
        </span>
      </div>

      {showForm && (
        <div className="mt-5 rounded-xl border border-ink-200 bg-white p-5">
          <h2 className="font-semibold text-ink-900">{editingId ? "Edit source" : "Add source"}</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-sm">
              <span className="text-ink-700">Name</span>
              <input className={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label className="text-sm">
              <span className="text-ink-700">Type</span>
              <select className={input} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value, isOfficial: AGGREGATORS.includes(e.target.value) ? false : form.isOfficial })}>
                {types.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </label>
            {isApi ? (
              <label className="text-sm md:col-span-2">
                <span className="text-ink-700">Search query</span>
                <input className={input} value={form.query} onChange={(e) => setForm({ ...form, query: e.target.value })} placeholder='e.g. (tourist OR travel) AND (visa OR "entry rules")' />
              </label>
            ) : (
              <>
                <div className="text-sm md:col-span-2">
                  <span className="text-ink-700">Feed URL</span>
                  <div className="flex gap-2">
                    <input className={input} value={form.rssUrl} onChange={(e) => setForm({ ...form, rssUrl: e.target.value })} placeholder="https://example.com/feed/" />
                    <button type="button" onClick={testFeed} disabled={busy === "preview" || !form.rssUrl} className="shrink-0 rounded-lg border border-ink-200 px-3 py-2 text-sm hover:bg-ink-50 disabled:opacity-50">
                      {busy === "preview" ? "Testing…" : "Test feed"}
                    </button>
                  </div>
                  {previewError && <p className="mt-2 text-xs text-[#DC2626]">Feed check failed: {previewError}</p>}
                  {preview && (
                    <div className="mt-2 rounded-lg border border-ink-200 bg-ink-50 p-3 text-xs">
                      <p className="font-medium text-ink-900">
                        {preview.itemCount} items, {preview.travelCount} look travel-related · newest{" "}
                        {preview.newestAt ? new Date(preview.newestAt).toLocaleDateString() : "undated"} · nothing was saved
                      </p>
                      <ul className="mt-1 space-y-0.5">
                        {preview.sample.map((it, i) => (
                          <li key={i} className={it.travel ? "text-ink-800" : "text-ink-400"}>
                            {it.travel ? "✓" : "·"} {it.title}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                <label className="text-sm md:col-span-2">
                  <span className="text-ink-700">Website (optional)</span>
                  <input className={input} value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://example.com" />
                </label>
              </>
            )}
            <label className="text-sm">
              <span className="text-ink-700">Category</span>
              <select className={input} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="text-ink-700">Country focus (optional)</span>
              <input className={input} value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
            </label>
            <label className="text-sm">
              <span className="text-ink-700">Reliability (0–100)</span>
              <input type="number" min={0} max={100} className={input} value={form.reliabilityScore} onChange={(e) => setForm({ ...form, reliabilityScore: Number(e.target.value) })} />
            </label>
            <label className="text-sm">
              <span className="text-ink-700">Priority</span>
              <select className={input} value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}>
                {[5, 4, 3, 2, 1].map((p) => (
                  <option key={p} value={p}>{p}{p === 5 ? " (highest)" : p === 1 ? " (lowest)" : ""}</option>
                ))}
              </select>
            </label>
            <label className={`flex items-start gap-2 text-sm ${AGGREGATORS.includes(form.type) ? "opacity-50" : ""}`}>
              <input
                type="checkbox"
                className="mt-1"
                checked={!!form.isOfficial}
                disabled={AGGREGATORS.includes(form.type)}
                onChange={(e) => setForm({ ...form, isOfficial: e.target.checked })}
              />
              <span>
                <span className="text-ink-700">Official source</span>
                <span className="block text-xs text-ink-500">
                  Published by the body the news is about: a government, airline, airport, operator or tourism board. Research
                  treats one official source as enough to confirm a fact.
                </span>
              </span>
            </label>
            <label className="text-sm">
              <span className="text-ink-700">Check every (minutes, 10–1440)</span>
              <input type="number" min={10} max={1440} className={input} value={form.fetchIntervalMinutes} onChange={(e) => setForm({ ...form, fetchIntervalMinutes: Number(e.target.value) })} />
            </label>
          </div>
          <div className="mt-5 flex gap-2">
            <button onClick={save} disabled={busy === "save"} className="rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white hover:bg-ink-800 disabled:opacity-60">
              {busy === "save" ? "Saving…" : "Save"}
            </button>
            <button onClick={() => { setShowForm(false); setEditingId(null); }} className="rounded-lg border border-ink-200 px-4 py-2 text-sm hover:bg-ink-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="mt-5 overflow-x-auto rounded-xl border border-ink-200 bg-white">
        {sources.length === 0 ? (
          <div className="p-8 text-center text-sm text-ink-600">No sources yet. Click “Load recommended sources” to start.</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-ink-50 text-xs text-ink-500">
              <tr>
                <th className="px-4 py-2">Source</th>
                <th className="px-4 py-2">Category</th>
                <th className="px-4 py-2">Rel.</th>
                <th className="px-4 py-2">Prio.</th>
                <th className="px-4 py-2">Every</th>
                <th className="px-4 py-2">Last check</th>
                <th className="px-4 py-2">Active</th>
                {canEdit && <th className="px-4 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {sources
                .filter((s) => filter === "all" || (filter === "official" ? s.isOfficial : s.isOfficial && !s.isActive && !s.lastFetchedAt))
                .map((s) => (
                <tr key={s.id} className={s.isActive ? "" : "opacity-50"}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-ink-900">
                      {s.name}
                      {s.isOfficial && <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-800">Official</span>}
                      {s.isOfficial && !s.isActive && !s.lastFetchedAt && <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">To review</span>}
                    </div>
                    <div className="max-w-xs truncate text-xs text-ink-500">{s.type === "newsapi" || s.type === "currents" ? s.query : s.rssUrl}</div>
                  </td>
                  <td className="px-4 py-3 text-ink-700">{s.category || "—"}</td>
                  <td className="px-4 py-3">{s.reliabilityScore}</td>
                  <td className="px-4 py-3">{s.priority}</td>
                  <td className="px-4 py-3">{s.fetchIntervalMinutes}m</td>
                  <td className="px-4 py-3 text-xs">
                    {s.lastStatus === "error" ? (
                      <span className="text-[#DC2626]" title={s.lastError}>
                        error ×{s.consecutiveFailures}: {s.lastError.slice(0, 40)}
                      </span>
                    ) : s.lastFetchedAt ? (
                      <span className="text-ink-600">{ago(s.lastFetchedAt)} · {s.lastItemCount} items</span>
                    ) : (
                      <span className="text-ink-400">never</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={s.isActive} disabled={!canEdit} onChange={() => toggle(s)} />
                  </td>
                  {canEdit && (
                    <td className="whitespace-nowrap px-4 py-3 text-right text-xs">
                      <button onClick={() => test(s)} disabled={busy === s.id} className="mr-2 underline disabled:opacity-50">
                        {busy === s.id ? "Fetching…" : "Fetch now"}
                      </button>
                      <button onClick={() => edit(s)} className="mr-2 underline">Edit</button>
                      <button onClick={() => remove(s)} className="text-[#DC2626] underline">Delete</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
