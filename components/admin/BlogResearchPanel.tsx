"use client";

// Research for one blog topic: run it, add pages, and see the sources read and
// the cited facts, with facts that go out of date marked.

import { useEffect, useState } from "react";
import { useToast } from "@/components/ToastProvider";
import type { BlogResearch } from "@/lib/blogs/research";

const SUB: Record<string, string> = {
  places: "Places", practical: "Practical", tickets: "Tickets & prices", seasons: "Seasons & weather",
  transport: "Getting there & around", food: "Food", history: "History", other: "Other",
};

export default function BlogResearchPanel({ topicId, canEdit }: { topicId: string; canEdit: boolean }) {
  const toast = useToast();
  const [r, setR] = useState<BlogResearch | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [url, setUrl] = useState("");

  useEffect(() => {
    fetch(`/api/admin/blogs/research?topicId=${topicId}`)
      .then((res) => res.json())
      .then((d) => setR(d.research))
      .finally(() => setLoading(false));
  }, [topicId]);

  async function run() {
    setRunning(true);
    try {
      const res = await fetch("/api/admin/blogs/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId, urls: url.trim() ? [url.trim()] : [] }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Research failed.");
      setR(d.research);
      setUrl("");
      if (d.research.status === "done") toast.success(`${d.research.facts.length} cited facts from ${d.research.sources.filter((s: any) => s.ok).length} sources.`);
      else toast.error(d.research.error);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setRunning(false);
    }
  }

  const groups = new Map<string, BlogResearch["facts"]>();
  for (const f of r?.facts || []) groups.set(f.subtopic, [...(groups.get(f.subtopic) || []), f]);
  const read = r?.finishedAt ? new Date(r.finishedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "";

  return (
    <div className="mt-3 space-y-3 rounded-lg bg-ink-50 p-4 text-sm">
      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <input
            className="min-w-0 flex-1 rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-sm"
            placeholder="Optional: add a page to read (official tourism site, attraction page)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <button onClick={run} disabled={running} className="rounded-lg bg-ink-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-ink-700 disabled:opacity-50">
            {running ? "Researching… (about 30 s)" : r ? "Run research again" : "Run research"}
          </button>
        </div>
      )}
      {loading && <p className="text-ink-500">Loading…</p>}
      {!loading && !r && <p className="text-ink-500">No research yet. It reads Wikivoyage, Wikipedia and any page you add, then lists cited facts.</p>}
      {r?.status === "failed" && <p className="font-medium text-red-700">{r.error}</p>}
      {r && (
        <>
          <div>
            <p className="font-semibold text-ink-900">Sources</p>
            <ol className="mt-1 space-y-0.5">
              {r.sources.map((s) => (
                <li key={s.n} className={s.ok ? "text-ink-700" : "text-ink-400"}>
                  [{s.n}]{" "}
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline">{s.publisher ? `${s.publisher}: ` : ""}{s.title}</a>
                  {!s.ok && ` (${s.note})`}
                </li>
              ))}
            </ol>
          </div>
          {r.status === "done" && (
            <div>
              <p className="font-semibold text-ink-900">
                {r.facts.length} facts{read ? `, read ${read}` : ""} · {r.facts.filter((f) => f.volatile).length} to check before visiting
              </p>
              {[...groups].map(([k, facts]) => (
                <div key={k} className="mt-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-ink-500">{SUB[k] || k}</p>
                  <ul className="mt-1 space-y-1">
                    {facts.map((f, i) => (
                      <li key={i} className="text-ink-800">
                        {f.claim} <span className="text-ink-400">[{f.sources.join(", ")}]</span>
                        {f.volatile && <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-900">check before visiting</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
