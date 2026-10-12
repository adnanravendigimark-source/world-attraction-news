"use client";

// Editor panel for AI blogs: research summary, the outline with a "Rewrite"
// button per section, and the FAQ editor.

import { useEffect, useState } from "react";
import { useToast } from "@/components/ToastProvider";

interface Data {
  topicId: string;
  topic: string;
  sections: { heading: string; words: number }[];
  facts: number;
  sources: number;
  toCheck: number;
}

export default function BlogPanel({
  articleId,
  faq,
  hasUnsavedEdits,
  onFaqSaved,
}: {
  articleId: string;
  faq: { q: string; a: string }[];
  hasUnsavedEdits: boolean;
  onFaqSaved?: () => void;
}) {
  const toast = useToast();
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState<string>("");
  const [items, setItems] = useState(faq.length ? faq : [{ q: "", a: "" }]);

  useEffect(() => {
    fetch(`/api/admin/blogs/article?articleId=${articleId}`)
      .then((r) => r.json())
      .then((d) => setData(d.blog));
  }, [articleId]);

  async function rewrite(index: number) {
    if (hasUnsavedEdits) {
      toast.error("Save your edits first; rewriting a section replaces the saved text.");
      return;
    }
    setBusy(`s${index}`);
    try {
      const res = await fetch("/api/admin/blogs/article", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ articleId, action: "regenerate", index }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Rewrite failed.");
      toast.success(`Section rewritten (${d.words} words). Fact check: ${d.verdict.replace("_", " ")}. Reloading…`);
      setTimeout(() => window.location.reload(), 900);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy("");
    }
  }

  async function saveFaq() {
    setBusy("faq");
    try {
      const clean = items.map((f) => ({ q: f.q.trim(), a: f.a.trim() })).filter((f) => f.q && f.a);
      const res = await fetch(`/api/admin/articles/${articleId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "edit", faq: clean }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Could not save the FAQ.");
      toast.success(`FAQ saved (${clean.length} questions). Re-run the fact check from the Ready bar if answers changed.`);
      onFaqSaved?.();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy("");
    }
  }

  const input = "w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:border-[#DC2626] focus:outline-none";
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900">AI blog</h3>
        <a href="/admin/blogs" className="text-xs text-slate-500 hover:underline">Travel Blogs →</a>
      </div>
      {data ? (
        <p className="text-xs text-slate-600">
          Topic “{data.topic}” · {data.facts} cited facts from {data.sources} sources{data.toCheck ? ` · ${data.toCheck} to check before visiting` : ""}
        </p>
      ) : (
        <p className="text-xs text-slate-400">Loading…</p>
      )}

      {data && data.sections.length > 0 && (
        <div>
          <p className="text-xs font-bold text-slate-900">Sections</p>
          <ol className="mt-1 space-y-1">
            {data.sections.map((s, i) => (
              <li key={i} className="flex items-center justify-between gap-2 text-xs text-slate-700">
                <span>{i + 1}. {s.heading}</span>
                <button onClick={() => rewrite(i)} disabled={!!busy} title="Write this section again from its facts" className="shrink-0 rounded-md border border-slate-200 px-2 py-1 text-[11px] hover:bg-slate-50 disabled:opacity-50">
                  {busy === `s${i}` ? "Rewriting…" : "Rewrite"}
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div>
        <p className="text-xs font-bold text-slate-900">FAQ (shown at the end of the guide)</p>
        <div className="mt-2 space-y-3">
          {items.map((f, i) => (
            <div key={i} className="space-y-1">
              <input className={input} placeholder="Question" value={f.q} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))} />
              <textarea className={input} rows={2} placeholder="Answer" value={f.a} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))} />
              <button onClick={() => setItems(items.filter((_, j) => j !== i))} className="text-[11px] text-slate-400 hover:text-rose-600">Remove</button>
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <button onClick={() => setItems([...items, { q: "", a: "" }])} className="rounded-md border border-slate-200 px-2 py-1 text-[11px] hover:bg-slate-50">+ Add question</button>
          <button onClick={saveFaq} disabled={busy === "faq"} className="rounded-md bg-slate-900 px-3 py-1 text-[11px] font-semibold text-white disabled:opacity-50">
            {busy === "faq" ? "Saving…" : "Save FAQ"}
          </button>
        </div>
      </div>
    </div>
  );
}
