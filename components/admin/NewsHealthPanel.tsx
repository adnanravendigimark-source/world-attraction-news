"use client";

import { useEffect, useState } from "react";
import type { HealthCheck } from "@/lib/news/ops";

const DOT = { ok: "bg-green-500", warn: "bg-amber-500", error: "bg-[#DC2626]" } as const;

// One-line health strip for the news pipeline; click to see every check.
export default function NewsHealthPanel() {
  const [checks, setChecks] = useState<HealthCheck[] | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch("/api/admin/news/health").then((r) => r.json()).then((d) => setChecks(d.checks || [])).catch(() => setChecks([]));
  }, []);

  if (!checks) return null;
  const bad = checks.filter((c) => c.level !== "ok");
  const worst = checks.some((c) => c.level === "error") ? "error" : bad.length ? "warn" : "ok";
  return (
    <div className="mt-4 rounded-xl border border-ink-200 bg-white px-4 py-2.5 text-sm">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 text-left">
        <span className={`h-2.5 w-2.5 rounded-full ${DOT[worst]}`} />
        <span className="font-medium text-ink-900">Pipeline health</span>
        <span className="text-ink-600">{bad.length ? bad.map((c) => `${c.label}: ${c.note}`).join(" · ") : "all checks passing"}</span>
        <span className="ml-auto text-xs text-ink-500">{open ? "Hide" : "Details"}</span>
      </button>
      {open && (
        <ul className="mt-2 grid gap-1 border-t border-ink-100 pt-2 sm:grid-cols-2">
          {checks.map((c) => (
            <li key={c.key} className="flex items-start gap-2 text-xs">
              <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${DOT[c.level]}`} />
              <span><b className="text-ink-800">{c.label}</b> <span className="text-ink-600">— {c.note}</span></span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
