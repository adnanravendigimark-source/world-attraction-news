"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useToast } from "@/components/ToastProvider";
import { useConfirm } from "@/components/ConfirmProvider";

interface Term {
  term: string;
  weight: number;
}
interface Config {
  relevantMin: number;
  borderlineMin: number;
  sourceBonus: number;
  categories: Record<string, Term[]>;
  negatives: Term[];
}
interface Draft {
  relevantMin: number;
  borderlineMin: number;
  sourceBonus: number;
  categories: { name: string; text: string }[];
  negatives: string;
}

// One "term: weight" per line keeps the lists easy to scan and edit.
const toText = (terms: Term[]) => terms.map((t) => `${t.term}: ${t.weight}`).join("\n");
function fromText(text: string, fallback = 10): Term[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^(.*?)(?:\s*[:=]\s*(\d+))?$/);
      return { term: (m?.[1] || line).trim(), weight: m?.[2] ? Number(m[2]) : fallback };
    });
}
const toDraft = (c: Config): Draft => ({
  relevantMin: c.relevantMin,
  borderlineMin: c.borderlineMin,
  sourceBonus: c.sourceBonus,
  categories: Object.entries(c.categories).map(([name, terms]) => ({ name, text: toText(terms) })),
  negatives: toText(c.negatives),
});
const fromDraft = (d: Draft): Config => ({
  relevantMin: Number(d.relevantMin),
  borderlineMin: Number(d.borderlineMin),
  sourceBonus: Number(d.sourceBonus),
  categories: Object.fromEntries(d.categories.filter((c) => c.name.trim()).map((c) => [c.name.trim(), fromText(c.text)])),
  negatives: fromText(d.negatives, 30),
});

export default function NewsFilterSettings({ canEdit }: { canEdit: boolean }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState("");
  const [tryTitle, setTryTitle] = useState("");
  const [tryDesc, setTryDesc] = useState("");
  const [tryResult, setTryResult] = useState<{ score: number; status: string; category: string; reason: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/news/filter")
      .then((r) => r.json())
      .then((d) => {
        if (d.config) {
          const dr = toDraft(d.config);
          setDraft(dr);
          setSaved(JSON.stringify(dr));
        } else toast.error(d.error || "Couldn't load the filter settings.");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!draft) return <p className="text-sm text-ink-500">Loading…</p>;
  const dirty = JSON.stringify(draft) !== saved;
  const input = "w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 focus:border-ink-400 focus:outline-none";

  async function save() {
    setBusy("save");
    try {
      const res = await fetch("/api/admin/news/filter", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ config: fromDraft(draft!) }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Save failed.");
      const dr = toDraft(d.config);
      setDraft(dr);
      setSaved(JSON.stringify(dr));
      toast.success(`Saved. ${d.count} stored items re-scored.`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy("");
    }
  }

  async function reset() {
    const ok = await confirm({ title: "Reset the filter to the default terms?", description: "Your edited terms and thresholds are removed, and stored items are re-scored.", confirmLabel: "Reset" });
    if (!ok) return;
    setBusy("reset");
    try {
      const res = await fetch("/api/admin/news/filter", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reset: true }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Reset failed.");
      const dr = toDraft(d.config);
      setDraft(dr);
      setSaved(JSON.stringify(dr));
      toast.success(`Defaults restored. ${d.count} stored items re-scored.`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy("");
    }
  }

  async function tryIt() {
    setBusy("try");
    try {
      const res = await fetch("/api/admin/news/filter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ try: { title: tryTitle, description: tryDesc, config: fromDraft(draft!) } }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Couldn't score it.");
      setTryResult(d.result);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy("");
    }
  }

  const setCat = (i: number, patch: Partial<{ name: string; text: string }>) =>
    setDraft({ ...draft, categories: draft.categories.map((c, j) => (j === i ? { ...c, ...patch } : c)) });

  return (
    <div>
      <Link href="/admin/news" className="text-xs text-ink-500 hover:underline">← Trending News</Link>
      <h1 className="mt-1 font-serif text-2xl font-bold text-ink-900">Travel filter</h1>
      <p className="mt-1 max-w-3xl text-sm text-ink-600">
        Every new item is scored 0–100 from these terms before anything else happens. A term in the headline counts 1.5 times its
        weight; in the teaser, its weight. Off-topic terms subtract. Items at or above the travel news threshold go on to Stories.
        Items from an official source count as travel news once they name any travel term. Write one term per line as
        <code className="mx-1 rounded bg-ink-100 px-1">term: weight</code>.
      </p>

      <div className="mt-5 rounded-xl border border-ink-200 bg-white p-5">
        <h2 className="font-semibold text-ink-900">Try a headline</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-[2fr_2fr_auto]">
          <input className={input} placeholder="Headline" value={tryTitle} onChange={(e) => setTryTitle(e.target.value)} />
          <input className={input} placeholder="Teaser (optional)" value={tryDesc} onChange={(e) => setTryDesc(e.target.value)} />
          <button onClick={tryIt} disabled={busy === "try" || !tryTitle.trim() || !canEdit} className="rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white hover:bg-ink-800 disabled:opacity-50">
            {busy === "try" ? "Scoring…" : "Score it"}
          </button>
        </div>
        {tryResult && (
          <p className="mt-2 text-sm">
            <strong>{tryResult.score}/100</strong> ·{" "}
            <span className={tryResult.status === "relevant" ? "text-green-700" : tryResult.status === "borderline" ? "text-amber-700" : "text-ink-500"}>
              {tryResult.status === "relevant" ? "travel news" : tryResult.status === "borderline" ? "weak" : "not travel"}
            </span>
            {tryResult.category && <> · {tryResult.category}</>} <span className="text-ink-500">· {tryResult.reason}</span>
            <span className="text-ink-400"> (uses the settings below, saved or not)</span>
          </p>
        )}
      </div>

      <div className="mt-5 grid gap-4 rounded-xl border border-ink-200 bg-white p-5 md:grid-cols-2">
        <label className="text-sm">
          <span className="text-ink-700">Travel news threshold</span>
          <input type="number" min={1} max={100} className={input} disabled={!canEdit} value={draft.relevantMin} onChange={(e) => setDraft({ ...draft, relevantMin: Number(e.target.value) })} />
        </label>
        <label className="text-sm">
          <span className="text-ink-700">Weak threshold (shown in the feed, not clustered)</span>
          <input type="number" min={0} max={99} className={input} disabled={!canEdit} value={draft.borderlineMin} onChange={(e) => setDraft({ ...draft, borderlineMin: Number(e.target.value) })} />
        </label>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {draft.categories.map((c, i) => (
          <div key={i} className="rounded-xl border border-ink-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <input className={`${input} font-medium`} disabled={!canEdit} value={c.name} onChange={(e) => setCat(i, { name: e.target.value })} />
              {canEdit && (
                <button onClick={() => setDraft({ ...draft, categories: draft.categories.filter((_, j) => j !== i) })} className="shrink-0 text-xs text-[#DC2626] underline">
                  Remove
                </button>
              )}
            </div>
            <textarea className={`${input} mt-2 h-48 font-mono text-xs`} disabled={!canEdit} value={c.text} onChange={(e) => setCat(i, { text: e.target.value })} />
          </div>
        ))}
        <div className="rounded-xl border border-red-200 bg-white p-4">
          <div className="text-sm font-medium text-ink-900">Off-topic terms (subtract)</div>
          <textarea className={`${input} mt-2 h-48 font-mono text-xs`} disabled={!canEdit} value={draft.negatives} onChange={(e) => setDraft({ ...draft, negatives: e.target.value })} />
        </div>
      </div>

      {canEdit && (
        <div className="sticky bottom-0 mt-5 flex flex-wrap gap-2 border-t border-ink-200 bg-white/95 py-3">
          <button onClick={save} disabled={!dirty || !!busy} className="rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white hover:bg-ink-800 disabled:opacity-50">
            {busy === "save" ? "Saving and re-scoring…" : dirty ? "Save and re-score items" : "Saved"}
          </button>
          <button onClick={() => setDraft({ ...draft, categories: [...draft.categories, { name: "New category", text: "" }] })} className="rounded-lg border border-ink-200 px-4 py-2 text-sm hover:bg-ink-50">
            Add category
          </button>
          <button onClick={reset} disabled={!!busy} className="ml-auto rounded-lg border border-ink-200 px-4 py-2 text-sm hover:bg-ink-50 disabled:opacity-50">
            {busy === "reset" ? "Resetting…" : "Reset to defaults"}
          </button>
        </div>
      )}
    </div>
  );
}
