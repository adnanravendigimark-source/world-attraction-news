"use client";

import { useState } from "react";
import { applyLink } from "@/lib/news/guidelinks";

interface Suggestion {
  name: string;
  type: string;
  place: string;
  url: string;
  mentions: number;
}

// Suggests links to World Attraction Guide pages found in the article text.
// The editor decides: nothing is added until "Add link" is clicked.
export default function NewsGuideLinks({ html, onChange }: { html: string; onChange: (html: string) => void }) {
  const [list, setList] = useState<Suggestion[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function find() {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/admin/news/guide-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) setList(d.suggestions || []);
      else setErr(d.error || "Couldn't load suggestions.");
    } catch {
      setErr("Couldn't load suggestions.");
    }
    setBusy(false);
  }

  function add(s: Suggestion) {
    onChange(applyLink(html, s.name, s.url));
    setList((l) => (l ? l.filter((x) => x.url !== s.url) : l));
  }

  return (
    <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold text-slate-900">Links to World Attraction Guide</p>
        <button type="button" onClick={find} disabled={busy} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">
          {busy ? "Checking…" : "Suggest links"}
        </button>
      </div>
      {err && <p className="text-[11px] text-red-600">{err}</p>}
      {list && list.length === 0 && <p className="text-[11px] text-slate-500">No matching guide pages are mentioned in this article.</p>}
      {list && list.length > 0 && (
        <ul className="space-y-1.5">
          {list.map((s) => (
            <li key={s.url} className="flex items-center justify-between gap-3 text-xs">
              <span className="min-w-0 truncate">
                <span className="font-semibold text-slate-900">{s.name}</span>
                <span className="text-slate-500"> · {s.place} · {s.type} · {s.mentions}×</span>
              </span>
              <button type="button" onClick={() => add(s)} className="shrink-0 rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-bold">
                Add link
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
