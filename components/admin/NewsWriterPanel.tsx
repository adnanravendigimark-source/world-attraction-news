"use client";

import { useEffect, useState } from "react";
import NewsQualityPanel from "@/components/admin/NewsQualityPanel";

interface Issue {
  text: string;
  problem: string;
  severity: "high" | "low";
  origin?: "rule" | "model";
}
interface Claim {
  text: string;
  supported: boolean;
  facts: string[];
}
interface Check {
  verdict: "passed" | "needs_review" | "failed";
  issues: Issue[];
  claims: Claim[];
  overridden: boolean;
  overrideReason: string;
  checkedAt: string;
  stale: boolean;
}

const VERDICT: Record<Check["verdict"], { label: string; box: string }> = {
  passed: { label: "passed", box: "border-green-200 bg-green-50" },
  needs_review: { label: "needs review", box: "border-amber-200 bg-amber-50" },
  failed: { label: "failed", box: "border-red-200 bg-red-50" },
};

// AI writer + fact check for a news draft. Writing replaces the article body,
// title and SEO fields with a fresh draft built from the researched facts;
// the fact check (with one automatic revision) then runs as a second request.
export default function NewsWriterPanel({ articleId, hasUnsavedEdits }: { articleId: string; hasUnsavedEdits: boolean }) {
  const [check, setCheck] = useState<Check | null>(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [overriding, setOverriding] = useState(false);
  const [reason, setReason] = useState("");

  useEffect(() => {
    fetch(`/api/admin/news/write?articleId=${articleId}`)
      .then((r) => r.json())
      .then((d) => setCheck(d.check || null))
      .catch(() => {});
  }, [articleId]);

  async function post(body: Record<string, unknown>): Promise<any> {
    const res = await fetch("/api/admin/news/write", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ articleId, ...body }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error || "Failed.");
    return d;
  }

  async function write() {
    setBusy("write");
    setConfirm(false);
    try {
      setMsg("Writing the article… about 30 seconds.");
      await post({ action: "write" });
      setMsg("Checking every claim against the research… about 30 seconds.");
      await post({ action: "verify" });
      window.location.reload(); // show the new text in the editor
      return;
    } catch (e: any) {
      setMsg(e.message || "Request failed. Try again.");
    }
    setBusy("");
  }

  async function run(action: "check" | "override") {
    setBusy(action);
    setMsg(action === "check" ? "Checking facts…" : "");
    try {
      const d = await post(action === "override" ? { action, reason } : { action });
      setCheck(d.check);
      setOverriding(false);
      setReason("");
      setMsg(action === "check" ? "Fact check updated." : "Override recorded.");
    } catch (e: any) {
      setMsg(e.message || "Request failed. Try again.");
    }
    setBusy("");
  }

  const supported = check?.claims?.filter((c) => c.supported).length ?? 0;
  const total = check?.claims?.length ?? 0;
  const v = check ? VERDICT[check.verdict] : null;

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
      <p className="text-xs font-bold text-slate-900">AI writer and fact check</p>
      <p className="text-[11px] text-slate-500">
        Writes the article, SEO fields and internal links from the story's researched facts only, then checks every claim against them. Needs research to be run first.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {!confirm ? (
          <button type="button" disabled={!!busy} onClick={() => setConfirm(true)} className="rounded-lg bg-[#DC2626] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">
            {busy === "write" ? "Writing…" : "Write article with AI"}
          </button>
        ) : (
          <>
            <span className="text-[11px] text-slate-700">
              This replaces the title, text and SEO fields{hasUnsavedEdits ? " and discards your unsaved edits" : ""}.
            </span>
            <button type="button" onClick={write} className="rounded-lg bg-[#DC2626] px-3 py-1.5 text-xs font-bold text-white">Replace</button>
            <button type="button" onClick={() => setConfirm(false)} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold">Cancel</button>
          </>
        )}
        <button type="button" disabled={!!busy} onClick={() => run("check")} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">
          {busy === "check" ? "Checking…" : "Re-run fact check"}
        </button>
      </div>
      {msg && <p className="text-[11px] text-slate-600">{msg}</p>}

      <NewsQualityPanel articleId={articleId} refreshKey={check?.checkedAt || ""} />

      {check && v && (
        <div className={`rounded-xl border p-2.5 text-xs ${check.stale ? "border-amber-200 bg-amber-50" : v.box}`}>
          <p className="font-bold">
            Fact check: {v.label}
            {check.verdict === "failed" && check.overridden ? " (override approved)" : ""}
            <span className="ml-2 font-normal text-slate-500">{new Date(check.checkedAt).toLocaleString()}</span>
          </p>
          {check.stale && (
            <p className="mt-1 font-semibold text-amber-800">The text changed after this check. Save your edits, then re-run the check before publishing.</p>
          )}
          {total > 0 && <p className="mt-1 text-slate-600">{supported} of {total} factual sentences supported by the research.</p>}
          {check.overridden && check.overrideReason && <p className="mt-1 text-slate-600">Override reason: {check.overrideReason}</p>}
          {check.issues.length > 0 && (
            <ul className="mt-1.5 space-y-1.5">
              {check.issues.map((i, idx) => (
                <li key={idx}>
                  <span className={`mr-1 rounded px-1 py-0.5 text-[10px] font-bold uppercase ${i.severity === "high" ? "bg-red-200 text-red-800" : "bg-amber-100 text-amber-800"}`}>
                    {i.severity === "high" ? "fix" : "review"}
                  </span>
                  <span className="font-semibold">“{i.text}”</span> — {i.problem}
                </li>
              ))}
            </ul>
          )}
          {check.verdict === "failed" && !check.overridden && !check.stale && (
            !overriding ? (
              <button type="button" disabled={!!busy} onClick={() => setOverriding(true)} className="mt-2 rounded-lg border border-red-300 bg-white px-2.5 py-1 text-[11px] font-bold text-red-700">
                I've reviewed these: allow publishing anyway
              </button>
            ) : (
              <div className="mt-2 space-y-1.5">
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  placeholder="Why is this safe to publish? (e.g. checked the airline's press release)"
                  className="w-full rounded-lg border border-red-200 bg-white p-2 text-[11px]"
                />
                <div className="flex gap-2">
                  <button type="button" disabled={!!busy || reason.trim().length < 10} onClick={() => run("override")} className="rounded-lg bg-red-700 px-2.5 py-1 text-[11px] font-bold text-white disabled:opacity-50">
                    Record override
                  </button>
                  <button type="button" onClick={() => setOverriding(false)} className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-bold">Cancel</button>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
