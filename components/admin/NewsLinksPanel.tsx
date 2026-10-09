"use client";

import { useCallback, useEffect, useState } from "react";

interface Link {
  id: number;
  targetUrl: string;
  targetType: "site_country" | "site_city" | "site_article";
  entityName: string;
  placement: "in_text" | "related_box";
  status: "applied" | "removed";
}

const TYPE: Record<Link["targetType"], string> = { site_city: "City", site_country: "Country", site_article: "Article" };

// Links from this story to the site's own pages: up to 3 in the text, the
// rest in the Related box under the story. Changes that touch the text are
// saved straight to the article, so the editor reloads afterwards.
export default function NewsLinksPanel({ articleId, hasUnsavedEdits }: { articleId: string; hasUnsavedEdits: boolean }) {
  const [links, setLinks] = useState<Link[]>([]);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(() => {
    fetch(`/api/admin/news/links?articleId=${articleId}`)
      .then((r) => r.json())
      .then((d) => setLinks(d.links || []))
      .catch(() => {});
  }, [articleId]);

  useEffect(() => {
    load();
  }, [load]);

  async function post(body: Record<string, unknown>, touchesText: boolean, key: string) {
    if (touchesText && hasUnsavedEdits) {
      setMsg("Save your edits first: this changes the article text.");
      return;
    }
    setBusy(key);
    setMsg("");
    try {
      const res = await fetch("/api/admin/news/links", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ articleId, ...body }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Couldn't change the link.");
      setLinks(d.links || []);
      if (touchesText) {
        setMsg("Saved. Reloading the editor…");
        setTimeout(() => window.location.reload(), 600);
      } else setMsg("Saved.");
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy("");
    }
  }

  const inText = links.filter((l) => l.status === "applied" && l.placement === "in_text");
  const related = links.filter((l) => l.status === "applied" && l.placement === "related_box");
  const removed = links.filter((l) => l.status === "removed");
  const btn = "rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-700 disabled:opacity-50";

  const row = (l: Link, actions: React.ReactNode) => (
    <li key={l.id} className="flex items-center justify-between gap-2 text-xs">
      <span className="min-w-0 truncate">
        <span className="mr-1 rounded bg-slate-100 px-1 text-[10px] text-slate-500">{TYPE[l.targetType]}</span>
        <a href={l.targetUrl} target="_blank" rel="noopener noreferrer" className="text-slate-800 underline decoration-slate-300">{l.entityName}</a>
      </span>
      <span className="flex shrink-0 gap-1">{actions}</span>
    </li>
  );

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-slate-900">Links to this site</p>
        <button type="button" className={btn} disabled={!!busy} onClick={() => post({ refresh: true }, true, "refresh")} title="Plan the links again from the current text (removed pages stay out)">
          {busy === "refresh" ? "Planning…" : "Re-plan links"}
        </button>
      </div>

      <div>
        <p className="text-[11px] font-bold text-slate-600">In the text ({inText.length}/3)</p>
        {inText.length === 0 ? (
          <p className="text-[11px] text-slate-500">None. Links are never placed in the first paragraph, a heading or a caption.</p>
        ) : (
          <ul className="mt-1 space-y-1">
            {inText.map((l) =>
              row(l, <>
                <button type="button" className={btn} disabled={!!busy} onClick={() => post({ linkId: l.id, action: "to_related" }, true, `r${l.id}`)}>To Related</button>
                <button type="button" className={btn} disabled={!!busy} onClick={() => post({ linkId: l.id, action: "remove" }, true, `x${l.id}`)}>Remove</button>
              </>)
            )}
          </ul>
        )}
      </div>

      <div>
        <p className="text-[11px] font-bold text-slate-600">Related box under the story ({related.length})</p>
        {related.length === 0 ? (
          <p className="text-[11px] text-slate-500">{inText.length ? "Only the links in the text are listed." : "Empty: the box is hidden on the public page."}</p>
        ) : (
          <ul className="mt-1 space-y-1">
            {related.map((l) =>
              row(l, <>
                {l.targetType !== "site_article" && inText.length < 3 && (
                  <button type="button" className={btn} disabled={!!busy} onClick={() => post({ linkId: l.id, action: "to_text" }, true, `t${l.id}`)}>Link in text</button>
                )}
                <button type="button" className={btn} disabled={!!busy} onClick={() => post({ linkId: l.id, action: "remove" }, false, `x${l.id}`)}>Remove</button>
              </>)
            )}
          </ul>
        )}
      </div>

      {removed.length > 0 && (
        <div>
          <p className="text-[11px] font-bold text-slate-600">Removed (never added again automatically)</p>
          <ul className="mt-1 space-y-1">
            {removed.map((l) => row(l, <button type="button" className={btn} disabled={!!busy} onClick={() => post({ linkId: l.id, action: "restore" }, false, `s${l.id}`)}>Restore</button>))}
          </ul>
        </div>
      )}

      {msg && <p className="text-[11px] text-slate-600">{msg}</p>}
    </div>
  );
}
