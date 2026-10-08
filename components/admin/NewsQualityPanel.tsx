"use client";

import { useEffect, useState } from "react";

interface Check {
  key: string;
  label: string;
  ok: boolean;
  weight: number;
  earned: number;
  note: string;
}

// Quality summary for a generated news draft (research, facts, SEO, image,
// links, duplicates). Computed from what is stored, no model calls.
export default function NewsQualityPanel({ articleId, refreshKey = "" }: { articleId: string; refreshKey?: string }) {
  const [data, setData] = useState<{ score: number; checks: Check[] } | null>(null);

  useEffect(() => {
    fetch(`/api/admin/news/pipeline?articleId=${articleId}`)
      .then((r) => r.json())
      .then((d) => setData(d.quality || null))
      .catch(() => {});
  }, [articleId, refreshKey]);

  if (!data) return null;
  const tone = data.score >= 85 ? "bg-green-600" : data.score >= 65 ? "bg-amber-500" : "bg-red-600";
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs">
      <div className="flex items-center gap-2">
        <span className={`rounded px-2 py-0.5 text-sm font-bold text-white ${tone}`}>{data.score}/100</span>
        <span className="font-bold text-slate-900">Quality score</span>
      </div>
      <ul className="mt-2 space-y-1">
        {data.checks.map((c) => (
          <li key={c.key} className="flex gap-2">
            <span className={c.ok ? "text-green-600" : c.earned > 0 ? "text-amber-600" : "text-red-600"}>{c.ok ? "✓" : c.earned > 0 ? "~" : "✗"}</span>
            <span>
              <span className="font-semibold text-slate-800">{c.label}</span>
              <span className="text-slate-500"> · {c.note}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
