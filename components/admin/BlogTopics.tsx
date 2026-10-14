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
      const d = await post("/api/admin/blogs/suggest", { destination });
      toast.success(`${d.topics.length} ideas for ${d.topics[0]?.destination || destination}.`);
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
  const list = topics.filter((t) => t.status === "queued" || t.status === "generating" || t.status === "drafted");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold text-ink-900">Travel Blogs</h1>
        <p className="mt-1 text-sm text-ink-600">Type a topic and its city or country to add it. Or type only a city or country to get topic ideas from AI.</p>
      </div>

      {canEdit && (
        <form onSubmit={addTopic} className="flex flex-col gap-2 rounded-xl border border-ink-200 bg-white p-4 md:flex-row">
          <input className={`${input} md:flex-[2]`} placeholder="Topic, e.g. Best time to visit Florence" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input
            className={`${input} md:flex-1`}
            placeholder={title.trim() ? "City or country (required)" : "City or country, e.g. Florence"}
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
          />
          {/* One action at a time: a typed topic is added as it is; with no
              topic, AI suggests topics for the destination. */}
          {title.trim() ? (
            <button
              disabled={!!busy || !destination.trim()}
              title={destination.trim() ? "" : "Type a city or country first"}
              className="shrink-0 rounded-lg bg-ink-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-ink-700 disabled:opacity-40"
            >
              {busy === "add" ? "Adding…" : "Add topic"}
            </button>
          ) : (
            <button
              type="button"
              onClick={suggest}
              disabled={!!busy || !destination.trim()}
              title={destination.trim() ? "" : "Type a city or country first"}
              className="shrink-0 rounded-lg bg-[#DC2626] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#B91C1C] disabled:opacity-40"
            >
              {busy === "suggest" ? "Thinking…" : "Suggest with AI"}
            </button>
          )}
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
          <ul className="divide-y divide-ink-100">
            {ideas.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink-900">{t.title}</p>
                  <p className="text-xs text-ink-500">
                    {t.destination}
                    {t.similarTitle && <span className="font-medium text-amber-800"> · Already covered: “{t.similarTitle}”</span>}
                  </p>
                </div>
                {canEdit && (
                  <>
                    <button onClick={() => setStatus([t.id], "queued")} disabled={!!busy} className="shrink-0 rounded-lg border border-ink-200 px-4 py-2 text-sm font-medium text-ink-800 hover:bg-ink-50 disabled:opacity-40">
                      Add
                    </button>
                    <button onClick={() => setStatus([t.id], "dismissed")} disabled={!!busy} aria-label={`Dismiss ${t.title}`} className="shrink-0 px-2 py-2 text-ink-400 hover:text-ink-800">
                      ✕
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-xl border border-ink-200 bg-white">
        <h2 className="border-b border-ink-100 px-5 py-3 font-semibold text-ink-900">Topics</h2>
        <ul className="divide-y divide-ink-100">
          {loading && <li className="px-5 py-4 text-sm text-ink-500">Loading…</li>}
          {!loading && list.length === 0 && <li className="px-5 py-4 text-sm text-ink-500">No topics yet. Add one above.</li>}
          {list.map((t) => {
            const written = t.status === "drafted" && t.articleId;
            const running = gen?.id === t.id;
            return (
              <li key={t.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink-900">{t.title}</p>
                  <p className="text-xs text-ink-500">
                    {t.destination}
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
