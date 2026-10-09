"use client";

import { useCallback, useEffect, useState } from "react";
import { IMAGE_SOURCE_TYPES, NEWS_COVER_SIZE, PROVENANCE_LABELS } from "@/lib/news/provenance";

interface Meta {
  sourceType: string;
  credit: string;
  license: string;
  sourceUrl: string;
  coverUrl?: string;
  width?: number | null;
  height?: number | null;
}
interface Candidate {
  url: string;
  publisher: string;
  itemUrl: string;
}

const TYPES = IMAGE_SOURCE_TYPES.map((v) => ({ v, l: `${PROVENANCE_LABELS[v].code} · ${PROVENANCE_LABELS[v].label}` }));

// Rights record for a news cover image, plus the story's feed images as
// reference candidates. Importing a candidate never marks it as cleared.
export default function NewsImagePanel({ articleId, onImported }: { articleId: string; onImported: (url: string, alt?: string) => void }) {
  const [direction, setDirection] = useState("");
  const [meta, setMeta] = useState<Meta>({ sourceType: "unverified", credit: "", license: "", sourceUrl: "" });
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [image, setImage] = useState("");
  const [inline, setInline] = useState(true);

  const load = useCallback(() => {
    fetch(`/api/admin/news/images?articleId=${articleId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.meta) setMeta(d.meta);
        if (d.candidates) setCandidates(d.candidates);
        setImage(d.image || "");
      })
      .catch(() => {});
  }, [articleId]);

  useEffect(() => {
    load();
  }, [load]);

  const sized = !!image && meta.coverUrl === image && meta.width === NEWS_COVER_SIZE.width && meta.height === NEWS_COVER_SIZE.height;

  async function recrop() {
    setBusy("crop");
    setMsg("Cropping the cover to 1200×675…");
    try {
      const res = await fetch("/api/admin/news/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId, recrop: true }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setMeta(d.meta);
        setImage(d.url);
        onImported(d.url);
        setMsg("Cover cropped to 1200×675.");
      } else setMsg(d.error || "Cropping failed.");
    } catch {
      setMsg("Cropping failed. Try again.");
    }
    setBusy("");
  }

  async function save() {
    setBusy("save");
    setMsg("");
    const res = await fetch("/api/admin/news/images", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ articleId, ...meta }),
    });
    const d = await res.json().catch(() => ({}));
    setMsg(res.ok ? "Image rights saved." : d.error || "Couldn't save.");
    setBusy("");
  }

  async function generate() {
    setBusy("gen");
    setMsg("Generating image… this takes 20–40 seconds.");
    try {
      const res = await fetch("/api/admin/news/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId, generate: true, direction }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setMeta(d.meta);
        setImage(d.url);
        onImported(d.url, d.alt);
        setMsg("AI cover generated, cropped to 1200×675 and saved.");
      } else setMsg(d.error || "Generation failed.");
    } catch {
      setMsg("Generation failed. Check your connection and try again.");
    }
    setBusy("");
  }

  async function autoPhotos() {
    setBusy("auto");
    setMsg("Searching free-licence photos… up to 40 seconds.");
    try {
      const res = await fetch("/api/admin/news/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId, auto: true, inline }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setMsg(`Done: cover is ${d.cover === "licensed" ? "a licensed photo" : d.cover === "ai" ? "AI-generated (no free photo found)" : "unchanged"}, ${d.inline} photo(s) added inside the article. Reloading…`);
        setTimeout(() => window.location.reload(), 900);
      } else setMsg(d.error || "Photo search failed.");
    } catch {
      setMsg("Photo search failed. Try again.");
    }
    setBusy("");
  }

  async function importOne(url: string) {
    setBusy(url);
    setMsg("");
    const res = await fetch("/api/admin/news/images", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ articleId, imageUrl: url }),
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok) {
      setMeta(d.meta);
      setImage(d.url);
      onImported(d.url);
      setMsg("Imported as cover (cropped to 1200×675). Record the real rights below before publishing.");
    } else setMsg(d.error || "Import failed.");
    setBusy("");
  }

  const input = "w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-[#DC2626] focus:outline-none";

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
      <p className="text-xs font-bold text-slate-900">Cover image</p>

      {image && (
        <div className="space-y-1">
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg border border-slate-200 bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="" className="h-full w-full object-cover" />
            <span className="absolute left-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">
              {PROVENANCE_LABELS[(meta.sourceType as keyof typeof PROVENANCE_LABELS)]?.code || "OTHER"}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            {sized ? (
              <span className="text-green-700">✓ 1200×675 (16:9)</span>
            ) : (
              <>
                <span className="text-amber-700">Not cropped to 1200×675{meta.width && meta.coverUrl === image ? ` (${meta.width}×${meta.height})` : ""}</span>
                <button type="button" onClick={recrop} disabled={!!busy} className="rounded border border-slate-300 bg-white px-2 py-0.5 font-bold text-slate-800 disabled:opacity-50">
                  {busy === "crop" ? "Cropping…" : "Re-crop to 1200×675"}
                </button>
              </>
            )}
          </div>
          <p className="text-[11px] text-slate-500">Save the article after uploading a new cover; uploads are cropped to 1200×675 automatically.</p>
        </div>
      )}

      <div className="space-y-1">
        <button type="button" onClick={autoPhotos} disabled={!!busy} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">
          {busy === "auto" ? "Finding photos…" : inline ? "Auto-find photos (cover + in-article)" : "Auto-find a cover photo"}
        </button>
        <label className="flex items-center gap-1.5 text-[11px] text-slate-600">
          <input type="checkbox" checked={inline} onChange={(e) => setInline(e.target.checked)} />
          Also place photos inside the article (only for stories of 350+ words)
        </label>
        <p className="text-[11px] text-slate-500">Finds real, free-to-use photos (Wikimedia Commons, Unsplash if configured), credits them, and places them between paragraphs. Falls back to an AI image for the cover only if none is found.</p>
      </div>

      <div className="space-y-2">
        <input
          className={input}
          placeholder="Optional direction, e.g. “sunset over a hotel facade” (otherwise built from the headline)"
          value={direction}
          onChange={(e) => setDirection(e.target.value)}
        />
        <button type="button" onClick={generate} disabled={!!busy} className="rounded-lg bg-[#DC2626] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">
          {busy === "gen" ? "Generating…" : "Generate cover with AI"}
        </button>
        <p className="text-[11px] text-slate-500">Creates a realistic scene-setting image (not a photo of the actual event). Labelled AI-generated on the public page.</p>
      </div>

      <p className="pt-1 text-xs font-bold text-slate-900">Rights</p>

      {candidates.length > 0 && (
        <div>
          <p className="mb-1 text-[11px] text-slate-500">Images from this story's sources (reference only; the publisher owns them):</p>
          <div className="flex flex-wrap gap-2">
            {candidates.map((c) => (
              <button
                key={c.url}
                type="button"
                disabled={!!busy}
                onClick={() => importOne(c.url)}
                title={`Use as cover (${c.publisher})`}
                className="relative h-16 w-24 overflow-hidden rounded-lg border border-slate-200 bg-white disabled:opacity-50"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.url} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                {busy === c.url && <span className="absolute inset-0 flex items-center justify-center bg-white/70 text-[10px]">…</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <select className={input} value={meta.sourceType} onChange={(e) => setMeta({ ...meta, sourceType: e.target.value })}>
          {TYPES.map((t) => (
            <option key={t.v} value={t.v}>{t.l}</option>
          ))}
        </select>
        <input className={input} placeholder="Credit (photographer / agency)" value={meta.credit} onChange={(e) => setMeta({ ...meta, credit: e.target.value })} />
        <input className={input} placeholder="License (e.g. Getty editorial, CC BY 4.0)" value={meta.license} onChange={(e) => setMeta({ ...meta, license: e.target.value })} />
        <input className={input} placeholder="Source URL" value={meta.sourceUrl} onChange={(e) => setMeta({ ...meta, sourceUrl: e.target.value })} />
      </div>

      <div className="flex items-center gap-3">
        <button type="button" onClick={save} disabled={!!busy} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">
          {busy === "save" ? "Saving…" : "Save image rights"}
        </button>
        {msg && <span className="text-[11px] text-slate-600">{msg}</span>}
      </div>
    </div>
  );
}
