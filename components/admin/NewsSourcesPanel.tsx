"use client";

import { useEffect, useState } from "react";

interface Source {
  title: string;
  url: string;
  publisher: string;
  isOfficial: boolean;
}

const blank: Source = { title: "", url: "", publisher: "", isOfficial: false };

// Edit the sources listed under a news article: add, remove, reorder, mark
// as official. Shown publicly under the article in this order.
export default function NewsSourcesPanel({ articleId, onSaved }: { articleId: string; onSaved?: () => void }) {
  const [list, setList] = useState<Source[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch(`/api/admin/news/article-sources?articleId=${articleId}`)
      .then((r) => r.json())
      .then((d) => setList((d.sources || []).map((s: any) => ({ title: s.title, url: s.url, publisher: s.publisher, isOfficial: !!s.isOfficial }))))
      .finally(() => setLoaded(true));
  }, [articleId]);

  const change = (next: Source[]) => {
    setList(next);
    setDirty(true);
    setMsg("");
  };
  const set = (i: number, patch: Partial<Source>) => change(list.map((s, k) => (k === i ? { ...s, ...patch } : s)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    change(next);
  };

  async function save() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/news/article-sources", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId, sources: list.filter((s) => s.url.trim()) }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Could not save.");
      setList(d.sources.map((s: any) => ({ title: s.title, url: s.url, publisher: s.publisher, isOfficial: !!s.isOfficial })));
      setDirty(false);
      setMsg("Sources saved.");
      onSaved?.();
    } catch (e: any) {
      setMsg(e.message);
    }
    setBusy(false);
  }

  const input = "w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-800 focus:border-[#DC2626] focus:outline-none";

  return (
    <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-slate-900">Sources</p>
        <span className="text-[11px] text-slate-500">Shown under the article, in this order</span>
      </div>
      {!loaded ? (
        <p className="text-[11px] text-slate-500">Loading…</p>
      ) : list.length === 0 ? (
        <p className="text-[11px] text-slate-500">No sources yet. Publishing needs at least one.</p>
      ) : (
        <ol className="space-y-2">
          {list.map((s, i) => (
            <li key={i} className="rounded-xl border border-slate-200 bg-white p-2">
              <div className="flex gap-2">
                <span className="pt-1 text-[11px] font-bold text-slate-400">{i + 1}</span>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="grid grid-cols-2 gap-1">
                    <input className={input} placeholder="Publisher (e.g. Reuters)" value={s.publisher} onChange={(e) => set(i, { publisher: e.target.value })} />
                    <input className={input} placeholder="Headline" value={s.title} onChange={(e) => set(i, { title: e.target.value })} />
                  </div>
                  <input className={input} placeholder="https://…" value={s.url} onChange={(e) => set(i, { url: e.target.value })} />
                  <label className="flex items-center gap-1.5 text-[11px] text-slate-600">
                    <input type="checkbox" checked={s.isOfficial} onChange={(e) => set(i, { isOfficial: e.target.checked })} />
                    Official source (government, airline, airport, operator)
                  </label>
                </div>
                <div className="flex flex-col gap-0.5">
                  <button type="button" aria-label="Move up" onClick={() => move(i, -1)} className="rounded border border-slate-200 px-1.5 text-[11px] hover:bg-slate-50">↑</button>
                  <button type="button" aria-label="Move down" onClick={() => move(i, 1)} className="rounded border border-slate-200 px-1.5 text-[11px] hover:bg-slate-50">↓</button>
                  <button type="button" aria-label="Remove source" onClick={() => change(list.filter((_, k) => k !== i))} className="rounded border border-red-200 px-1.5 text-[11px] text-red-700 hover:bg-red-50">✕</button>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => change([...list, { ...blank }])} className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-bold">
          + Add source
        </button>
        <button type="button" onClick={save} disabled={!dirty || busy} className="rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-white disabled:opacity-40">
          {busy ? "Saving…" : "Save sources"}
        </button>
        {msg && <span className="text-[11px] text-slate-600">{msg}</span>}
      </div>
    </div>
  );
}
