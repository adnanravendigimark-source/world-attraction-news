"use client";

import { useState } from "react";
import type { ArticleAudit } from "@/lib/news/audit";

const fmt = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

// "AI history" for a news article: answers which story, sources, facts,
// models, prompts, editors and approvals produced it. Loaded on demand.
export default function NewsAuditPanel({ articleId }: { articleId: string }) {
  const [open, setOpen] = useState(false);
  const [audit, setAudit] = useState<ArticleAudit | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/news/audit?articleId=${articleId}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Couldn't load the history.");
      setAudit(d.audit);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !audit) load();
  }

  const approval = audit?.timeline.filter((e) => /^Review: (approved|published)|^Published$/i.test(e.what)).at(-1);
  const facts: [string, React.ReactNode][] = audit
    ? [
        ["Story", audit.story ? `${audit.story.title} · first seen ${fmt(audit.story.firstSeenAt)} · ${audit.story.sourceCount} source(s)` : "Not linked to a story"],
        ["Sources", audit.sources.length ? audit.sources.map((s) => `${s.publisher}${s.isOfficial ? " (official)" : ""}`).join(", ") : "None listed"],
        ["Research", audit.research ? `${audit.research.facts} facts from ${audit.research.sources} source(s) · ${audit.research.model} · ${fmt(audit.research.at)}` : "None"],
        ["Written by", audit.generation ? `${audit.generation.model} · prompt ${audit.generation.promptVersion} · ${audit.generation.wordCount} words · ${fmt(audit.generation.writtenAt)}` : "Not written by AI"],
        [
          "Fact check",
          audit.check
            ? `${audit.check.verdict}${audit.check.stale ? " (text changed since)" : ""} · ${audit.check.model} · ${fmt(audit.check.at)}${audit.check.overridden ? ` · overridden: ${audit.check.overrideReason}` : ""}`
            : "Not run",
        ],
        ["Approved", approval ? `${approval.who} · ${fmt(approval.at)}` : audit.article.status === "published" ? `Published ${fmt(audit.article.publishedAt)}` : "Not yet"],
        [
          "AI usage",
          `${audit.totals.calls} call(s)${audit.totals.failed ? `, ${audit.totals.failed} failed` : ""} · ${audit.totals.tokensIn.toLocaleString()} in / ${audit.totals.tokensOut.toLocaleString()} out tokens · about $${audit.totals.costUsd.toFixed(3)}`,
        ],
      ]
    : [];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <button type="button" onClick={toggle} className="flex w-full items-center justify-between px-4 py-3 text-left">
        <span className="text-xs font-bold text-slate-900">AI history and audit</span>
        <span className="text-xs text-slate-500">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <div className="space-y-4 border-t border-slate-100 px-4 py-3 text-xs">
          {loading && <p className="text-slate-500">Loading…</p>}
          {error && <p className="text-[#DC2626]">{error}</p>}
          {audit && (
            <>
              <dl className="grid gap-x-4 gap-y-1.5 sm:grid-cols-[8rem_1fr]">
                {facts.map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="font-semibold text-slate-600">{k}</dt>
                    <dd className="text-slate-800">{v}</dd>
                  </div>
                ))}
              </dl>

              <div>
                <p className="mb-1 font-semibold text-slate-600">Timeline</p>
                {audit.timeline.length === 0 ? (
                  <p className="text-slate-500">Nothing recorded yet.</p>
                ) : (
                  <ol className="max-h-80 space-y-1 overflow-y-auto border-l-2 border-slate-100 pl-3">
                    {audit.timeline.map((e, i) => (
                      <li key={i}>
                        <span className="text-slate-400">{fmt(e.at)}</span> · <span className="font-medium text-slate-700">{e.who}</span> · {e.what}
                        {e.detail && <span className="text-slate-500"> — {e.detail}</span>}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
              <button type="button" onClick={load} className="rounded border border-slate-300 px-2 py-0.5 text-[11px] text-slate-700">
                Refresh
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
