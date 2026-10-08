"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ToastProvider";
import type { ResearchRecord } from "@/lib/news/research";

const CONF: Record<string, string> = {
  confirmed: "bg-emerald-100 text-emerald-800",
  single_source: "bg-amber-100 text-amber-800",
  conflicting: "bg-red-100 text-red-700",
};

export default function NewsResearchPanel({ clusterId, canEdit, initialStatus, onStatus }: { clusterId: string; canEdit: boolean; initialStatus: string; onStatus: (s: string) => void }) {
  const toast = useToast();
  const [rec, setRec] = useState<ResearchRecord | null>(null);
  const [loading, setLoading] = useState(!!initialStatus);
  const [running, setRunning] = useState(false);
  const [drafting, setDrafting] = useState(false);

  useEffect(() => {
    if (!initialStatus) return;
    fetch(`/api/admin/news/research?clusterId=${clusterId}`)
      .then((r) => r.json())
      .then((d) => setRec(d.research || null))
      .finally(() => setLoading(false));
  }, [clusterId, initialStatus]);

  async function run() {
    setRunning(true);
    try {
      const res = await fetch("/api/admin/news/research", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clusterId }) });
      const data = await res.json();
      if (data.research) {
        setRec(data.research);
        onStatus(data.research.status);
      }
      if (!res.ok) toast.error(data.error || data.research?.error || "Research failed.");
      else toast.success("Facts extracted. Review them below.");
    } catch (e: any) {
      toast.error(e.message || "Research failed.");
    } finally {
      setRunning(false);
    }
  }

  const [stage, setStage] = useState("");
  const [quality, setQuality] = useState<{ score: number; checks: { key: string; label: string; ok: boolean; earned: number; note: string }[] } | null>(null);

  async function step(body: Record<string, unknown>): Promise<any> {
    const res = await fetch("/api/admin/news/pipeline", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Step failed.");
    return data;
  }

  // Research (if needed) -> article + SEO + links -> image -> quality -> editor.
  async function makeDraft() {
    setDrafting(true);
    setQuality(null);
    try {
      setStage("Reading sources and extracting facts…");
      await step({ step: "research", clusterId });
      setStage("Writing the article, SEO and internal links…");
      const w = await step({ step: "write", clusterId });
      setStage("Checking every claim against the research…");
      await step({ step: "check", articleId: w.articleId });
      setStage("Finding a relevant image…");
      await step({ step: "images", articleId: w.articleId });
      setStage("Running quality checks…");
      const q = await step({ step: "quality", articleId: w.articleId });
      setQuality(q.quality);
      setStage(`Draft saved. Quality ${q.quality.score}/100. Opening the editor…`);
      toast.success(`Draft created (${w.wordCount} words, quality ${q.quality.score}/100).`);
      setTimeout(() => { window.location.href = w.adminUrl; }, 2500);
    } catch (e: any) {
      toast.error(e.message);
      setStage(`Stopped: ${e.message}`);
      setDrafting(false);
    }
  }

  const f = rec?.facts;
  const srcLabel = (ns: number[]) => ns.map((n) => `[${n}]`).join(" ");

  return (
    <div className="mt-3 rounded-lg border border-ink-200 bg-ink-50 p-4 text-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="font-semibold text-ink-900">Research</div>
        {canEdit && (
          <div className="flex gap-2">
          <button onClick={makeDraft} disabled={drafting} className="rounded-lg border border-ink-300 bg-white px-3 py-1.5 text-xs font-medium text-ink-900 hover:bg-ink-50 disabled:opacity-60">
            {drafting ? "Creating draft…" : "Create news draft"}
          </button>
          <button onClick={run} disabled={running} className="rounded-lg bg-ink-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-ink-800 disabled:opacity-60">
            {running ? "Researching… (up to 90s)" : rec ? "Run again" : "Run research"}
          </button>
          </div>
        )}
      </div>
      {stage && <p className="mt-2 text-xs font-medium text-ink-800">{stage}</p>}
      {quality && (
        <ul className="mt-2 space-y-0.5 text-xs">
          {quality.checks.map((c) => (
            <li key={c.key}>
              <span className={c.ok ? "text-green-600" : c.earned > 0 ? "text-amber-600" : "text-red-600"}>{c.ok ? "✓" : c.earned > 0 ? "~" : "✗"}</span> {c.label} <span className="text-ink-500">· {c.note}</span>
            </li>
          ))}
        </ul>
      )}
      {loading && <p className="mt-2 text-xs text-ink-500">Loading…</p>}
      {!loading && !rec && <p className="mt-2 text-xs text-ink-500">No research yet. This reads the story&apos;s sources and extracts structured facts. It doesn&apos;t write an article.</p>}
      {rec?.status === "failed" && <p className="mt-2 text-xs text-[#DC2626]">Failed: {rec.error}</p>}

      {f && rec?.status === "done" && (
        <div className="mt-3 space-y-3">
          <dl className="grid gap-x-6 gap-y-2 md:grid-cols-2">
            {([
              ["What happened", f.what_happened],
              ["When", f.when],
              ["Where", f.where],
              ["Who is affected", f.who_is_affected],
              ["What changed", f.what_changed],
            ] as const).map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs uppercase tracking-wide text-ink-500">{k}</dt>
                <dd className="text-ink-900">{v}</dd>
              </div>
            ))}
          </dl>

          {f.important_facts.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-wide text-ink-500">Facts</div>
              <ul className="mt-1 space-y-1">
                {f.important_facts.map((x, i) => (
                  <li key={i} className="flex gap-2">
                    <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${CONF[x.confidence]}`}>{x.confidence.replace("_", " ")}</span>
                    <span>{x.claim} <span className="text-ink-500">{srcLabel(x.sources)}</span></span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {f.confirmed_numbers.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-wide text-ink-500">Numbers</div>
              <ul className="mt-1 space-y-0.5">
                {f.confirmed_numbers.map((n, i) => (
                  <li key={i}><strong>{n.value}</strong> — {n.context} <span className="text-ink-500">{srcLabel(n.sources)}</span></li>
                ))}
              </ul>
            </div>
          )}

          {([["Uncertain claims", f.uncertain_claims], ["Conflicts between sources", f.conflicts], ["Missing information", f.missing_info]] as const).map(
            ([label, list]) =>
              list.length > 0 && (
                <div key={label}>
                  <div className="text-xs uppercase tracking-wide text-ink-500">{label}</div>
                  <ul className="mt-1 list-disc pl-5">{list.map((x, i) => <li key={i}>{x}</li>)}</ul>
                </div>
              )
          )}

          <div className="rounded border border-dashed border-ink-300 p-2 text-xs text-ink-600">
            <strong>Traveler impact (model&apos;s reading, not a verified fact):</strong> {f.traveler_impact}
          </div>

          <div>
            <div className="text-xs uppercase tracking-wide text-ink-500">Sources used</div>
            <ol className="mt-1 space-y-0.5">
              {rec.sources.map((s) => (
                <li key={s.n} className="text-xs">
                  [{s.n}]{" "}
                  <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="underline">{s.publisher}</a>
                  <span className="text-ink-500"> · reliability {s.reliability}{s.official ? " · official" : ""} · {s.note}</span>
                </li>
              ))}
            </ol>
          </div>
          <p className="text-xs text-ink-400">Model: {rec.model}. Extracted facts only; fact-checking is the next step and has not been run.</p>
        </div>
      )}
    </div>
  );
}
