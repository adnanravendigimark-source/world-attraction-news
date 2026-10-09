"use client";

import { useCallback, useEffect, useState } from "react";

interface Readiness {
  ready: boolean;
  problems: string[];
  quality: { score: number; min: number };
  factCheck: { verdict: string; stale: boolean; overridden: boolean } | null;
  sources: { count: number; official: number };
  image: { ok: boolean; note: string };
  links: { ok: boolean; note: string };
}

type Tone = "good" | "warn" | "bad";
const TONE: Record<Tone, string> = {
  good: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warn: "border-amber-200 bg-amber-50 text-amber-900",
  bad: "border-red-200 bg-red-50 text-red-700",
};

function Item({ label, value, tone }: { label: string; value: string; tone: Tone }) {
  return (
    <div className={`rounded-lg border px-3 py-1.5 ${TONE[tone]}`}>
      <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">{label}</p>
      <p className="text-xs font-bold">{value}</p>
    </div>
  );
}

// One-line summary at the top of the news editor: is this article ready to
// publish, and if not, what is left. "Ready" comes from the same publish gate
// the Publish button uses. Reflects the last saved version of the article.
export default function NewsReadyBar({ articleId, refreshKey = "" }: { articleId: string; refreshKey?: string }) {
  const [data, setData] = useState<Readiness | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/news/readiness?articleId=${articleId}`, { cache: "no-store" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Could not check readiness.");
      setData(d);
      setError("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [articleId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  if (error) return <div className="rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-500">Readiness: {error}</div>;
  if (!data) return <div className="rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-500">Checking whether this article is ready…</div>;

  const fc = data.factCheck;
  const fcTone: Tone = !fc || fc.stale ? "bad" : fc.verdict === "passed" || fc.overridden ? "good" : fc.verdict === "needs_review" ? "warn" : "bad";
  const fcValue = !fc ? "Not run" : fc.stale ? "Out of date" : fc.verdict === "failed" && fc.overridden ? "Overridden" : fc.verdict.replace("_", " ");
  const q = data.quality;

  return (
    <div className={`rounded-2xl border p-3 sm:p-4 shadow-2xs ${data.ready ? "border-emerald-300 bg-white" : "border-slate-200 bg-white"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-lg px-3 py-1.5 text-xs font-black uppercase tracking-wider ${data.ready ? "bg-emerald-600 text-white" : "bg-slate-900 text-white"}`}>
          {data.ready ? "Ready to publish" : `Not ready · ${data.problems.length} to fix`}
        </span>
        <Item label="Fact check" value={fcValue} tone={fcTone} />
        <Item label="Quality" value={`${q.score}/100${q.min ? ` (min ${q.min})` : ""}`} tone={q.score >= (q.min || 0) ? (q.score >= 85 ? "good" : "warn") : "bad"} />
        <Item label="Sources" value={`${data.sources.count}${data.sources.official ? ` · ${data.sources.official} official` : ""}`} tone={data.sources.count >= 2 ? "good" : data.sources.count === 1 ? "warn" : "bad"} />
        <Item label="Image" value={data.image.ok ? "Done" : "Missing rights"} tone={data.image.ok ? "good" : "bad"} />
        <Item label="Links" value={data.links.ok ? "Done" : "None added"} tone={data.links.ok ? "good" : "warn"} />
        <button type="button" onClick={load} disabled={loading} className="ml-auto rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          {loading ? "Checking…" : "Refresh"}
        </button>
      </div>
      {data.problems.length > 0 && (
        <ul className="mt-2.5 list-disc space-y-0.5 pl-5 text-xs text-slate-700">
          {data.problems.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-[11px] text-slate-400">Based on the last saved version. Save your edits, then Refresh.</p>
    </div>
  );
}
