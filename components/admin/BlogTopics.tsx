"use client";

// Travel Blogs: type a topic (or ask AI for ideas for a destination), then
// click Generate article. Everything else happens in the backend.

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ToastProvider";
import type { BlogTopic } from "@/lib/blogs/topics";
import { generateBlog } from "@/lib/blogs/clientGenerate";

// The topic type and length follow from the title, so the admin never picks them.
const TYPES: [RegExp, string, number][] = [
  [/best time|when to (go|visit)|weather|season/i, "best_time", 1000],
  [/things to do|what to do|activities/i, "things_to_do", 1500],
  [/itinerary|\d+\s*days?/i, "itinerary", 1500],
  [/food|eat|restaurant|cuisine|dish/i, "food", 1200],
  [/ticket|admission|entry fee|how to book/i, "tickets", 1000],
  [/history|historic/i, "history", 1200],
  [/attraction|landmark|sights|places to visit/i, "attractions", 1500],
];
function typeFor(title: string): { topicType: string; targetWords: number } {
  const hit = TYPES.find(([re]) => re.test(title));
  return hit ? { topicType: hit[1], targetWords: hit[2] } : { topicType: "travel_guide", targetWords: 1800 };
}

const input = "w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm focus:border-ink-400 focus:outline-none";

export default function BlogTopics({ canEdit }: { canEdit: boolean }) {
  const toast = useToast();
  const [topics, setTopics] = useState<BlogTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [title, setTitle] = useState("");
  const [destination, setDestination] = useState("");
  const [gen, setGen] = useState<{ id: string; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/blogs/topics");
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Could not load topics.");
      setTopics(d.topics);
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
      const d = await post("/api/admin/blogs/topics", { action: "create", title, destination, angle: "", ...typeFor(title) });
      toast.success(d.topic.similarTitle ? `Added. Similar to "${d.topic.similarTitle}".` : "Topic added.");
      setTitle("");
      await load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy("");
    }
  }

  async function suggest() {
    setBusy("suggest");
    try {
      const d = await post("/api/admin/blogs/suggest", { destination, topic: title });
      const where = d.topics[0]?.destination || destination;
      toast.success(title.trim() ? `Topic cluster for "${title.trim()}" (${where}): ${d.topics.length} articles.` : `${d.topics.length} ideas for ${where}.`);
      if (!destination.trim() && d.topics[0]?.destination) setDestination(d.topics[0].destination.split(",")[0]);
      await load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy("");
    }
  }

  async function setStatus(ids: string[], status: "queued" | "dismissed") {
    if (ids.length === 0) return;
    setBusy(ids.join());
    try {
      await post("/api/admin/blogs/topics", { action: "status", ids, status });
      await load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy("");
    }
  }

  async function generate(id: string) {
    setGen({ id, text: "Starting…" });
    try {
      const r = await generateBlog(id, (text) => setGen({ id, text }));
      toast.success(`Article ready (${r.wordCount} words${r.quality != null ? `, quality ${r.quality}/100` : ""}).`);
      window.location.href = r.adminUrl;
    } catch (e: any) {
      toast.error(e.message || "Generation failed.");
      setGen(null);
      load();
    }
  }

  const ideas = topics.filter((t) => t.status === "suggested");
  // Topics still to write. Once a topic has an article (draft or published)
  // it is managed on the Articles page, so it leaves this list.
  const list = topics.filter((t) => (t.status === "queued" || t.status === "generating") && !t.articleId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold text-ink-900">Travel Blogs</h1>
        <p className="mt-1 text-sm text-ink-600">Add a topic with its city or country. Or click Suggest with AI for blog ideas about your topic, or for a city or country.</p>
      </div>

      {canEdit && (
        <form onSubmit={addTopic} className="flex flex-col gap-2 rounded-xl border border-ink-200 bg-white p-4 md:flex-row">
          <input className={`${input} md:flex-[2]`} placeholder="Topic, e.g. Best time to visit Florence" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input
            className={`${input} md:flex-1`}
            placeholder={title.trim() ? "City or country (needed to add)" : "City or country, e.g. Florence"}
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
          />
          <button
            disabled={!!busy || !title.trim() || !destination.trim()}
            title={title.trim() && !destination.trim() ? "Type the city or country to add this topic" : ""}
            className="shrink-0 rounded-lg bg-ink-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-ink-700 disabled:opacity-40"
          >
            {busy === "add" ? "Adding…" : "Add topic"}
          </button>
          <button
            type="button"
            onClick={suggest}
            disabled={!!busy || (!title.trim() && !destination.trim())}
            title={title.trim() ? "Blog ideas about this topic" : "Blog ideas for this city or country"}
            className="shrink-0 rounded-lg bg-[#DC2626] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#B91C1C] disabled:opacity-40"
          >
            {busy === "suggest" ? "Thinking…" : "Suggest with AI"}
          </button>
        </form>
      )}

      {ideas.length > 0 && (
        <section className="rounded-xl border border-ink-200 bg-white">
          <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3">
            <h2 className="font-semibold text-ink-900">AI ideas</h2>
            {canEdit && (
              <button onClick={() => setStatus(ideas.map((t) => t.id), "dismissed")} disabled={!!busy} className="text-sm text-ink-500 hover:text-ink-800">
                Clear all
              </button>
            )}
          </div>
          {groupIdeas(ideas).map((g) => (
            <div key={g.key} className="border-b border-ink-100 last:border-b-0">
              {g.clustered && (
                <div className="flex flex-wrap items-center justify-between gap-2 bg-ink-50/60 px-5 py-2.5">
                  <p className="text-sm text-ink-700">
                    <span className="font-semibold text-ink-900">Topic cluster</span> · {g.items[0].destination} · 1 main guide, {g.items.length - 1} supporting
                  </p>
                  {canEdit && (
                    <button
                      onClick={() => setStatus(recommended(g.items).map((t) => t.id), "queued")}
                      disabled={!!busy || recommended(g.items).length === 0}
                      title="Adds the ideas worth writing: not already covered, and with source material to research"
                      className="rounded-lg bg-ink-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-ink-700 disabled:opacity-40"
                    >
                      Add recommended ({recommended(g.items).length})
                    </button>
                  )}
                </div>
              )}
              <ul className="divide-y divide-ink-100">
                {g.items.map((t) => (
                  <IdeaRow key={t.id} t={t} canEdit={canEdit} busy={!!busy} onAdd={() => setStatus([t.id], "queued")} onDismiss={() => setStatus([t.id], "dismissed")} />
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      <section className="rounded-xl border border-ink-200 bg-white">
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3">
          <h2 className="font-semibold text-ink-900">Topics to write</h2>
          <a href="/admin/articles?kind=ai_blog" className="text-sm text-ink-500 hover:text-ink-800">Written blogs →</a>
        </div>
        <ul className="divide-y divide-ink-100">
          {loading && <li className="px-5 py-4 text-sm text-ink-500">Loading…</li>}
          {!loading && list.length === 0 && <li className="px-5 py-4 text-sm text-ink-500">No topics waiting to be written. Add one above; written articles are on the Articles page.</li>}
          {list.map((t) => {
            const written = t.status === "drafted" && t.articleId;
            const running = gen?.id === t.id;
            return (
              <li key={t.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink-900">{t.title}</p>
                  <p className="text-xs text-ink-500">
                    {t.destination}
                    {t.plan && <span> · {NEED_LABEL[t.plan.need] || t.plan.need}</span>}
                    {written && <span> · {t.articleStatus === "published" ? "published" : "draft ready"}</span>}
                  </p>
                  {running && <p className="mt-1 text-xs font-medium text-blue-700">{gen.text}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {written ? (
                    <a href={`/admin/articles/${t.articleId}`} className="rounded-lg border border-ink-200 px-4 py-2 text-sm font-medium text-ink-800 hover:bg-ink-50">
                      {t.articleStatus === "published" ? "View" : "Open draft"}
                    </a>
                  ) : (
                    canEdit && (
                      <button
                        onClick={() => generate(t.id)}
                        disabled={!!gen}
                        title="Takes 2-4 minutes"
                        className="rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white hover:bg-ink-700 disabled:opacity-40"
                      >
                        {running ? "Generating…" : "Generate article"}
                      </button>
                    )
                  )}
                  {canEdit && !written && !running && (
                    <button onClick={() => setStatus([t.id], "dismissed")} disabled={!!busy || !!gen} aria-label={`Remove ${t.title}`} className="px-2 py-2 text-ink-400 hover:text-ink-800">
                      ✕
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

// ------------------------------------------------------------- AI ideas

const NEED_LABEL: Record<string, string> = {
  overview: "Main guide",
  decision: "Decision",
  booking: "Booking",
  practical: "Practical planning",
  itinerary: "Itinerary",
  seasonality: "Seasonality",
  accessibility: "Accessibility",
  comparison: "Comparison",
  experience: "Experience",
  preparation: "Preparation",
  prices: "Prices",
  history: "History",
};
const PRIORITY: Record<string, string> = { high: "bg-emerald-100 text-emerald-800", medium: "bg-blue-50 text-blue-800", low: "bg-ink-100 text-ink-600" };
const RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

// The ideas worth writing: not already covered on the site, and free sources
// have material to research them. The main guide is always included.
function recommended(items: BlogTopic[]): BlogTopic[] {
  return items.filter((t) => !t.similarTitle && (t.plan?.role === "pillar" || t.plan?.support === "found"));
}

// Ideas from one Suggest click about a topic form a cluster; city-only ideas
// are listed as before.
function groupIdeas(ideas: BlogTopic[]): { key: string; clustered: boolean; items: BlogTopic[] }[] {
  const groups = new Map<string, BlogTopic[]>();
  for (const t of ideas) {
    const k = t.clusterId && t.plan ? t.clusterId : "other";
    groups.set(k, [...(groups.get(k) || []), t]);
  }
  return [...groups.entries()].map(([key, items]) => ({
    key,
    clustered: key !== "other",
    items:
      key === "other"
        ? items
        : [...items].sort(
            (a, b) =>
              (a.plan!.role === "pillar" ? -1 : 0) - (b.plan!.role === "pillar" ? -1 : 0) ||
              RANK[a.plan!.priority] - RANK[b.plan!.priority] ||
              Number(!!a.similarTitle) - Number(!!b.similarTitle)
          ),
  }));
}

function IdeaRow({ t, canEdit, busy, onAdd, onDismiss }: { t: BlogTopic; canEdit: boolean; busy: boolean; onAdd: () => void; onDismiss: () => void }) {
  const [open, setOpen] = useState(false);
  const p = t.plan;
  return (
    <li className="px-5 py-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {p && (
              <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${p.role === "pillar" ? "bg-[#0B1527] text-white" : "bg-ink-100 text-ink-700"}`}>
                {NEED_LABEL[p.need] || p.need}
              </span>
            )}
            <p className="font-medium text-ink-900">{t.title}</p>
          </div>
          {p ? (
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-500">
              <span>
                Keyword: <span className="font-medium text-ink-700">{p.primaryKeyword}</span>
              </span>
              <span>· {p.intent}</span>
              <span className={`rounded px-1.5 py-0.5 font-medium capitalize ${PRIORITY[p.priority]}`}>{p.priority} priority</span>
              <span>· ~{t.targetWords} words</span>
              <span className={p.support === "found" ? "text-emerald-700" : "text-amber-800"}>· {p.support === "found" ? "Sources found" : "Sources thin"}</span>
              <button type="button" onClick={() => setOpen(!open)} className="font-medium text-ink-700 underline underline-offset-2">
                {open ? "Hide details" : "Details"}
              </button>
            </p>
          ) : (
            <p className="text-xs text-ink-500">{t.destination}</p>
          )}
          {t.similarTitle && <p className="mt-1 text-xs font-medium text-amber-800">Already covered: “{t.similarTitle}”</p>}
          {p && open && (
            <dl className="mt-2 grid gap-x-4 gap-y-1 rounded-lg bg-ink-50 p-3 text-xs text-ink-700 sm:grid-cols-[9rem_1fr]">
              <dt className="font-semibold">Why write it</dt>
              <dd>{p.reason || "—"}</dd>
              {t.angle && (
                <>
                  <dt className="font-semibold">Covers</dt>
                  <dd>{t.angle}</dd>
                </>
              )}
              <dt className="font-semibold">Audience</dt>
              <dd>{p.audience || "—"}</dd>
              <dt className="font-semibold">Related keywords</dt>
              <dd>{p.secondaryKeywords.join(", ") || "—"}</dd>
              <dt className="font-semibold">Research</dt>
              <dd>{p.supportNote || "Not checked"}</dd>
              <dt className="font-semibold">Internal links</dt>
              <dd>{p.links.length ? p.links.map((l) => l.name).join(", ") : "No published pages for this destination yet"}</dd>
              <dt className="font-semibold">Demand / difficulty</dt>
              <dd>Not available: no keyword data is connected, so none is estimated.</dd>
            </dl>
          )}
        </div>
        {canEdit && (
          <div className="flex shrink-0 items-center">
            <button onClick={onAdd} disabled={busy} className="rounded-lg border border-ink-200 px-4 py-2 text-sm font-medium text-ink-800 hover:bg-ink-50 disabled:opacity-40">
              Add
            </button>
            <button onClick={onDismiss} disabled={busy} aria-label={`Dismiss ${t.title}`} className="px-2 py-2 text-ink-400 hover:text-ink-800">
              ✕
            </button>
          </div>
        )}
      </div>
    </li>
  );
}
