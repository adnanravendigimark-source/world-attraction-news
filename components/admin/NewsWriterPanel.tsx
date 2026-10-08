"use client";

import { useEffect, useState } from "react";
import NewsQualityPanel from "@/components/admin/NewsQualityPanel";

interface Issue {
  text: string;
  problem: string;
  severity: "high" | "low";
}
interface Check {
  verdict: "pass" | "fail";
  issues: Issue[];
  overridden: boolean;
  checkedAt: string;
}

// AI writer + fact check for a news draft. Writing replaces the article body,
// title and SEO fields with a fresh draft built from the researched facts.
export default function NewsWriterPanel({ articleId, hasUnsavedEdits }: { articleId: string; hasUnsavedEdits: boolean }) {
  const [check, setCheck] = useState<Check | null>(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/news/write?articleId=${articleId}`)
      .then((r) => r.json())
      .then((d) => setCheck(d.check || null))
      .catch(() => {});
  }, [articleId]);

  async function run(action: "write" | "check" | "override") {
    setBusy(action);
    setMsg(action === "write" ? "Writing and fact-checking… about 30 seconds." : action === "check" ? "Checking facts…" : "");
    setConfirm(false);
    try {
      const res = await fetch("/api/admin/news/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId, action }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(d.error || "Failed.");
      } else if (action === "write") {
        window.location.reload(); // show the new text in the editor
        return;
      } else {
        setCheck(d.check);
        setMsg(action === "check" ? "Fact check updated." : "Override recorded.");
      }
    } catch {
      setMsg("Request failed. Try again.");
    }
    setBusy("");
  }

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
            <button type="button" onClick={() => run("write")} className="rounded-lg bg-[#DC2626] px-3 py-1.5 text-xs font-bold text-white">Replace</button>
            <button type="button" onClick={() => setConfirm(false)} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold">Cancel</button>
          </>
        )}
        <button type="button" disabled={!!busy} onClick={() => run("check")} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">
          {busy === "check" ? "Checking…" : "Re-run fact check"}
        </button>
      </div>
      {msg && <p className="text-[11px] text-slate-600">{msg}</p>}

      <NewsQualityPanel articleId={articleId} refreshKey={check?.checkedAt || ""} />

      {check && (
        <div className={`rounded-xl border p-2.5 text-xs ${check.verdict === "pass" ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
          <p className="font-bold">
            Fact check: {check.verdict === "pass" ? "passed" : check.overridden ? "failed (override approved)" : "failed"}
            <span className="ml-2 font-normal text-slate-500">{new Date(check.checkedAt).toLocaleString()}</span>
          </p>
          {check.issues.length > 0 && (
            <ul className="mt-1.5 space-y-1.5">
              {check.issues.map((i, idx) => (
                <li key={idx}>
                  <span className={`mr-1 rounded px-1 py-0.5 text-[10px] font-bold uppercase ${i.severity === "high" ? "bg-red-200 text-red-800" : "bg-amber-100 text-amber-800"}`}>{i.severity}</span>
                  <span className="font-semibold">“{i.text}”</span> — {i.problem}
                </li>
              ))}
            </ul>
          )}
          {check.verdict === "fail" && !check.overridden && (
            <button type="button" disabled={!!busy} onClick={() => run("override")} className="mt-2 rounded-lg border border-red-300 bg-white px-2.5 py-1 text-[11px] font-bold text-red-700">
              I've reviewed these: allow publishing anyway
            </button>
          )}
        </div>
      )}
    </div>
  );
}
