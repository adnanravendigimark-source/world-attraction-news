"use client";

// Travel Blogs: plan what to write. Type a topic, or ask for ideas for a
// destination, then queue the ones worth writing. Generation arrives in B4.

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ToastProvider";
import type { BlogTopic } from "@/lib/blogs/topics";
import BlogResearchPanel from "@/components/admin/BlogResearchPanel";
import { generateBlog } from "@/lib/blogs/clientGenerate";

const TYPES = [
  ["travel_guide", "Travel guide", 1800],
  ["things_to_do", "Things to do", 1500],
  ["attractions", "Attractions", 1500],
  ["itinerary", "Itinerary", 1500],
  ["best_time", "Best time to visit", 1000],
  ["food", "Food", 1200],
  ["tickets", "Tickets", 1000],
  ["history", "History", 1200],
] as const;
const typeLabel = (v: string) => TYPES.find((t) => t[0] === v)?.[1] || v;

const input = "w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm focus:border-ink-400 focus:outline-none";
const STATUS: Record<string, string> = {
  queued: "bg-blue-50 text-blue-800",
  generating: "bg-amber-100 text-amber-900",
  drafted: "bg-emerald-100 text-emerald-800",
};

export default function BlogTopics({ canEdit }: { canEdit: boolean }) {
  const toast = useToast();
  const [topics, setTopics] = useState<BlogTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [form, setForm] = useState({ title: "", destination: "", topicType: "travel_guide", angle: "", targetWords: 1800 });
  const [suggestFor, setSuggestFor] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState("");
  const [tab, setTab] = useState<"queued" | "generating" | "drafted" | "refresh">("queued");
  const [settings, setSettings] = useState<{ perDay: number; refreshMonths: number; newsIdeas: boolean } | null>(null);
  const [today, setToday] = useState(0);
  const [coreAuto, setCoreAuto] = useState(true);
  const [gen, setGen] = useState<{ id: string; text: string } | null>(null);

  async function generate(id: string) {
    setGen({ id, text: "Starting…" });
    try {
      const r = await generateBlog(id, (text) => setGen({ id, text }));
      toast.success(`Draft ready (${r.wordCount} words${r.quality != null ? `, quality ${r.quality}/100` : ""}).`);
      window.location.href = r.adminUrl;
    } catch (e: any) {
      toast.error(e.message || "Generation failed.");
      setGen(null);
      load();
    }
  }

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/blogs/topics");
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Could not load topics.");
      setTopics(d.topics);
      if (d.settings) setSettings(d.settings);
      setToday(Number(d.today) || 0);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function post(url: string, body: unknown) {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || "Failed.");
    return d;
  }

  async function addTopic(e: React.FormEvent) {
    e.preventDefault();
    setBusy("add");
    try {
      const d = await post("/api/admin/blogs/topics", { action: "create", ...form });
      toast.success(d.topic.similarTitle ? `Added. Note: similar to "${d.topic.similarTitle}".` : "Topic added to the queue.");
      setForm((f) => ({ ...f, title: "", angle: "" }));
      await load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy("");
    }
  }

  async function suggest(e: React.FormEvent) {
    e.preventDefault();
    setBusy("suggest");
    try {
      const d = await post("/api/admin/blogs/suggest", { destination: suggestFor });
      toast.success(`${d.topics.length} ideas for ${d.topics[0]?.destination || suggestFor}.`);
      setPicked(new Set(d.topics.filter((t: BlogTopic) => !t.similarTitle).map((t: BlogTopic) => t.id)));
      await load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy("");
    }
  }

  async function setStatus(ids: string[], status: "queued" | "dismissed") {
    if (ids.length === 0) return;
    setBusy(status);
    try {
      await post("/api/admin/blogs/topics", { action: "status", ids, status });
      setPicked(new Set());
      await load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy("");
    }
  }

  async function planCore() {
    setBusy("core");
    try {
      const d = await post("/api/admin/blogs/topics", { action: "core", destination: suggestFor, auto: coreAuto });
      toast.success(`${d.added} core guide(s) added${coreAuto ? " and set to write in the background" : ""}${d.skipped.length ? `; skipped ${d.skipped.length} already covered` : ""}.`);
      await load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy("");
    }
  }

  async function action(body: Record<string, unknown>, ok: string) {
    setBusy(String(body.action));
    try {
      const d = await post("/api/admin/blogs/topics", body);
      toast.success(typeof ok === "string" ? ok.replace("{flags}", String(d.flags ?? "")) : "Done.");
      await load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy("");
    }
  }

  const suggested = topics.filter((t) => t.status === "suggested");
  const byTab = {
    queued: topics.filter((t) => t.status === "queued"),
    generating: topics.filter((t) => t.status === "generating"),
    drafted: topics.filter((t) => t.status === "drafted"),
    refresh: topics.filter((t) => t.refreshFlags.length > 0 && t.articleStatus === "published"),
  };
  const planned = byTab[tab];
  const toggle = (id: string) =>
    setPicked((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold text-ink-900">Travel Blogs</h1>
        <p className="mt-1 text-sm text-ink-600">Plan evergreen guides: add a topic yourself or get ideas for a destination, then queue the ones to write.</p>
      </div>

      {canEdit && (
        <div className="grid gap-4 lg:grid-cols-2">
          <form onSubmit={addTopic} className="space-y-3 rounded-xl border border-ink-200 bg-white p-5">
            <h2 className="font-semibold text-ink-900">Add a topic</h2>
            <input className={input} placeholder="Topic, e.g. Best time to visit Florence" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <div className="grid gap-3 sm:grid-cols-2">
              <input className={input} placeholder="Destination: city or country" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} />
              <select
                className={input}
                value={form.topicType}
                onChange={(e) => {
                  const t = TYPES.find((x) => x[0] === e.target.value)!;
                  setForm({ ...form, topicType: t[0], targetWords: t[2] });
                }}
              >
                {TYPES.map((t) => (
                  <option key={t[0]} value={t[0]}>{t[1]}</option>
                ))}
              </select>
            </div>
            <input className={input} placeholder="Angle (optional): who it's for, what it covers" value={form.angle} onChange={(e) => setForm({ ...form, angle: e.target.value })} />
            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm text-ink-600">
                Max length
                <select className="rounded-lg border border-ink-200 px-2 py-1.5 text-sm" value={form.targetWords} onChange={(e) => setForm({ ...form, targetWords: Number(e.target.value) })}>
                  {[800, 1000, 1200, 1500, 1800, 2200].map((w) => (
                    <option key={w} value={w}>{w} words</option>
                  ))}
                </select>
              </label>
              <button disabled={busy === "add" || !form.title.trim() || !form.destination.trim()} className="rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white hover:bg-ink-700 disabled:opacity-50">
                {busy === "add" ? "Adding…" : "Add to queue"}
              </button>
            </div>
          </form>

          <form onSubmit={suggest} className="space-y-3 rounded-xl border border-ink-200 bg-white p-5">
            <h2 className="font-semibold text-ink-900">Suggest topics</h2>
            <p className="text-sm text-ink-600">Get 10 article ideas for a city or country. Ideas the site already covers are flagged.</p>
            <div className="flex gap-2">
              <input className={input} placeholder="Florence, Bali, Italy…" value={suggestFor} onChange={(e) => setSuggestFor(e.target.value)} />
              <button disabled={busy === "suggest" || !suggestFor.trim()} className="shrink-0 rounded-lg bg-[#DC2626] px-4 py-2 text-sm font-semibold text-white hover:bg-[#B91C1C] disabled:opacity-50">
                {busy === "suggest" ? "Thinking…" : "Suggest"}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-3 border-t border-ink-100 pt-3">
              <button type="button" onClick={planCore} disabled={busy === "core" || !suggestFor.trim()} className="rounded-lg border border-ink-200 px-3 py-1.5 text-sm font-medium text-ink-800 hover:bg-ink-50 disabled:opacity-50">
                {busy === "core" ? "Planning…" : "Plan 5 core guides"}
              </button>
              <label className="flex items-center gap-2 text-xs text-ink-600">
                <input type="checkbox" checked={coreAuto} onChange={(e) => setCoreAuto(e.target.checked)} />
                write them in the background
              </label>
              <span className="text-xs text-ink-400">Travel guide, things to do, best time, food, itinerary. No AI cost to plan.</span>
            </div>
          </form>
        </div>
      )}

      {suggested.length > 0 && (
        <section className="rounded-xl border border-ink-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 px-5 py-3">
            <h2 className="font-semibold text-ink-900">Ideas ({suggested.length})</h2>
            {canEdit && (
              <div className="flex gap-2">
                <button onClick={() => setStatus([...picked], "queued")} disabled={!picked.size || !!busy} className="rounded-lg bg-ink-900 px-3 py-1.5 text-sm text-white disabled:opacity-50">
                  Queue selected ({picked.size})
                </button>
                <button onClick={() => setStatus(suggested.filter((t) => !picked.has(t.id)).map((t) => t.id), "dismissed")} disabled={!!busy} className="rounded-lg border border-ink-200 px-3 py-1.5 text-sm text-ink-700 hover:bg-ink-50 disabled:opacity-50">
                  Dismiss the rest
                </button>
              </div>
            )}
          </div>
          <ul className="divide-y divide-ink-100">
            {suggested.map((t) => (
              <li key={t.id} className="flex items-start gap-3 px-5 py-3">
                <input type="checkbox" className="mt-1" checked={picked.has(t.id)} onChange={() => toggle(t.id)} disabled={!canEdit} aria-label={`Select ${t.title}`} />
                <div className="min-w-0">
                  <p className="font-medium text-ink-900">{t.title}</p>
                  <p className="text-xs text-ink-500">{[typeLabel(t.topicType), t.destination].join(" · ")}</p>
                  {t.angle && <p className="mt-0.5 text-sm text-ink-600">{t.angle}</p>}
                  {t.similarTitle && <p className="mt-1 text-xs font-medium text-amber-800">Similar to an existing article: “{t.similarTitle}”</p>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {settings && canEdit && (
        <section className="flex flex-wrap items-center gap-4 rounded-xl border border-ink-200 bg-white px-5 py-3 text-sm text-ink-700">
          <span className="font-semibold text-ink-900">Background writing</span>
          <span>{today} of {settings.perDay} written in the last 24 h</span>
          <label className="flex items-center gap-2">
            Blogs per day
            <input type="number" min={0} max={20} className="w-16 rounded-lg border border-ink-200 px-2 py-1" defaultValue={settings.perDay}
              onBlur={(e) => action({ action: "settings", settings: { perDay: Number(e.target.value) } }, "Saved.")} />
          </label>
          <label className="flex items-center gap-2">
            Re-check published guides every
            <input type="number" min={1} max={24} className="w-14 rounded-lg border border-ink-200 px-2 py-1" defaultValue={settings.refreshMonths}
              onBlur={(e) => action({ action: "settings", settings: { refreshMonths: Number(e.target.value) } }, "Saved.")} />
            months
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" defaultChecked={settings.newsIdeas} onChange={(e) => action({ action: "settings", settings: { newsIdeas: e.target.checked } }, "Saved.")} />
            Blog ideas from published news
          </label>
        </section>
      )}

      <section className="rounded-xl border border-ink-200 bg-white">
        <div className="border-b border-ink-100 px-5 py-3">
          <div className="flex flex-wrap gap-1" role="tablist">
            {([
              ["queued", "Queue"],
              ["generating", "In progress"],
              ["drafted", "Drafts"],
              ["refresh", "Needs refresh"],
            ] as const).map(([k, label]) => (
              <button
                key={k}
                role="tab"
                aria-selected={tab === k}
                onClick={() => setTab(k)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tab === k ? "bg-ink-900 text-white" : "text-ink-600 hover:bg-ink-50"}`}
              >
                {label} ({byTab[k].length})
              </button>
            ))}
          </div>
        </div>
        <ul className="divide-y divide-ink-100">
          {loading && <li className="px-5 py-4 text-sm text-ink-500">Loading…</li>}
          {!loading && planned.length === 0 && (
            <li className="px-5 py-4 text-sm text-ink-500">
              {tab === "queued"
                ? "No topics queued. Add one or get suggestions above."
                : tab === "generating"
                  ? "Nothing is being written right now."
                  : tab === "refresh"
                    ? "No published guide has changed facts. Guides are re-checked automatically."
                    : "No drafts yet. Generate a blog from the queue."}
            </li>
          )}
          {planned.map((t) => (
            <li key={t.id} className="px-5 py-3">
             <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-2">
                  <span className={`mt-0.5 shrink-0 rounded px-2 py-0.5 text-xs font-medium capitalize ${STATUS[t.status] || "bg-ink-100 text-ink-600"}`}>
                    {t.status === "drafted" && t.articleStatus ? t.articleStatus.replace("_", " ") : t.status === "generating" ? "in progress" : t.status}
                  </span>
                  <span className="font-medium text-ink-900">{t.title}</span>
                </div>
                <p className="mt-1 text-xs text-ink-500">
                  {[typeLabel(t.topicType), t.destination, `${t.targetWords} words`, t.source === "ai_suggested" ? "AI idea" : t.source === "from_news" ? "idea from news" : "added by hand"].join(" · ")}
                </p>
                {t.auto && <p className="mt-1 text-xs font-medium text-blue-700">Writing in the background{t.autoStep && t.autoStep !== "research" ? ` (next: ${t.autoStep})` : ""}. Runs every 10 minutes.</p>}
                {t.autoError && <p className="mt-1 text-xs font-medium text-red-700">Stopped: {t.autoError}</p>}
                {tab === "refresh" && (
                  <ul className="mt-2 space-y-1 text-xs">
                    {t.refreshFlags.map((f, i) => (
                      <li key={i} className="text-amber-900">
                        {f.status === "changed" ? "Changed: " : "No longer confirmed: "}“{f.fact}”{f.now ? ` → now: “${f.now}”` : ""}
                      </li>
                    ))}
                  </ul>
                )}
                {t.similarTitle && <p className="mt-1 text-xs font-medium text-amber-800">Similar to an existing article: “{t.similarTitle}”</p>}
                {gen?.id === t.id && <p className="mt-1 text-xs font-medium text-blue-700">{gen.text}</p>}
              </div>
              {canEdit && t.articleStatus === "published" && (
                <button onClick={() => action({ action: "refresh", id: t.id }, "Re-checked: {flags} fact(s) flagged.")} disabled={!!busy} title="Re-read the sources and compare prices, hours and rules (one small AI call)" className="shrink-0 rounded-lg border border-ink-200 px-3 py-2 text-sm text-ink-800 hover:bg-ink-50 disabled:opacity-50">
                  {busy === "refresh" ? "Checking…" : "Re-check facts"}
                </button>
              )}
              {t.articleId && (
                <a href={`/admin/articles/${t.articleId}`} className="shrink-0 rounded-lg border border-ink-200 px-4 py-2 text-sm font-medium text-ink-800 hover:bg-ink-50">
                  {t.articleStatus === "published" ? "View" : "Open draft"}
                </a>
              )}
              {canEdit && (t.status === "queued" || t.status === "generating") && (
                <div className="flex shrink-0 items-center gap-2">
                  <button onClick={() => setOpenId(openId === t.id ? "" : t.id)} className="rounded-lg border border-ink-200 px-3 py-2 text-sm text-ink-800 hover:bg-ink-50">
                    {openId === t.id ? "Hide research" : "Research"}
                  </button>
                  <button
                    onClick={() => generate(t.id)}
                    disabled={!!gen}
                    title="Research (if needed), outline, write each section, then the intro, conclusion and FAQ (2-4 minutes)"
                    className="rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white hover:bg-ink-700 disabled:opacity-50"
                  >
                    {gen?.id === t.id ? "Generating…" : "Generate blog"}
                  </button>
                  <button
                    onClick={() => action({ action: "auto", ids: [t.id], on: !t.auto }, t.auto ? "Background writing stopped." : "Will be written in the background (within the daily limit).")}
                    disabled={!!busy}
                    title="Write this blog in the background, one step every 10 minutes"
                    className="rounded-lg border border-ink-200 px-3 py-2 text-sm text-ink-800 hover:bg-ink-50 disabled:opacity-50"
                  >
                    {t.auto ? "Stop background" : "In background"}
                  </button>
                  <button onClick={() => setStatus([t.id], "dismissed")} disabled={!!busy} className="rounded-lg px-2 py-2 text-sm text-ink-400 hover:bg-ink-50 hover:text-ink-700">
                    Remove
                  </button>
                </div>
              )}
             </div>
              {openId === t.id && <BlogResearchPanel topicId={t.id} canEdit={canEdit} />}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
