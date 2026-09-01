"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import type { MediaItem } from "@/lib/media";
import { useConfirm } from "@/components/ConfirmProvider";
import { useToast } from "@/components/ToastProvider";

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function MediaCard({ item, onChanged }: { item: MediaItem; onChanged: (item: MediaItem | null) => void }) {
  const confirm = useConfirm();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [altText, setAltText] = useState(item.altText);
  const [caption, setCaption] = useState(item.caption);
  const [busy, setBusy] = useState(false);
  const [usageWarning, setUsageWarning] = useState<{
    cityHero: { id: string; name: string }[];
    articleCover: { id: string; title: string }[];
    articleContent: { id: string; title: string }[];
  } | null>(null);

  async function saveMeta() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/media/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ altText, caption }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      onChanged(data.item);
      setEditing(false);
      toast.success("Image details saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(force = false) {
    if (!force) {
      const ok = await confirm({
        title: "Delete this image?",
        description: "This removes the file entirely and cannot be undone.",
        confirmLabel: "Delete",
        danger: true,
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/media/${item.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const data = await res.json();
      if (res.status === 409 && data.needsConfirmation) {
        setUsageWarning(data.usage);
        return;
      }
      if (!res.ok) throw new Error(data.error || "Couldn't delete.");
      onChanged(null);
      toast.success("Image deleted.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border border-ink-200 bg-white">
      <div className="relative aspect-video bg-ink-50">
        <Image src={item.url} alt={item.altText || item.filename} fill className="object-cover" />
      </div>
      <div className="p-3">
        <p className="truncate text-xs font-semibold text-ink-800" title={item.filename}>
          {item.filename.split("/").pop()}
        </p>
        <p className="mt-0.5 text-[10px] text-ink-400">
          {formatBytes(item.sizeBytes)} · {formatDate(item.createdAt)}
        </p>

        {usageWarning && (
          <div className="mt-2 rounded border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-900">
            <p className="font-semibold">Still in use:</p>
            <ul className="mt-1 list-disc pl-4">
              {usageWarning.cityHero.map((c) => (
                <li key={c.id}>City hero: {c.name}</li>
              ))}
              {usageWarning.articleCover.map((a) => (
                <li key={a.id}>Article cover: {a.title}</li>
              ))}
              {usageWarning.articleContent.map((a) => (
                <li key={a.id}>In content: {a.title}</li>
              ))}
            </ul>
            <div className="mt-2 flex gap-2">
              <button
                disabled={busy}
                onClick={() => {
                  setUsageWarning(null);
                  handleDelete(true);
                }}
                className="rounded bg-signal px-2 py-1 text-[11px] font-semibold text-white hover:bg-signal-dark"
              >
                Delete Anyway
              </button>
              <button onClick={() => setUsageWarning(null)} className="rounded border border-amber-300 px-2 py-1 text-[11px] font-semibold text-amber-800">
                Cancel
              </button>
            </div>
          </div>
        )}

        {editing ? (
          <div className="mt-2 space-y-1.5">
            <input
              value={altText}
              onChange={(e) => setAltText(e.target.value)}
              placeholder="Alt text"
              className="w-full rounded border border-ink-300 px-2 py-1 text-[11px]"
            />
            <input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Caption"
              className="w-full rounded border border-ink-300 px-2 py-1 text-[11px]"
            />
            <div className="flex gap-1.5">
              <button disabled={busy} onClick={saveMeta} className="rounded bg-ink-900 px-2 py-1 text-[11px] font-semibold text-white hover:bg-ink-800">
                Save
              </button>
              <button onClick={() => setEditing(false)} className="rounded border border-ink-300 px-2 py-1 text-[11px] font-semibold text-ink-700">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            {item.altText && <p className="mt-1.5 truncate text-[11px] text-ink-500" title={item.altText}>Alt: {item.altText}</p>}
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button onClick={() => setEditing(true)} className="rounded border border-ink-300 px-2 py-1 text-[11px] font-semibold text-ink-700 hover:bg-ink-50">
                Edit
              </button>
              <button disabled={busy} onClick={() => handleDelete(false)} className="rounded px-2 py-1 text-[11px] font-semibold text-ink-400 hover:text-signal">
                Delete
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function MediaLibraryManager({ initialItems }: { initialItems: MediaItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.trim().toLowerCase();
    return items.filter((i) => i.filename.toLowerCase().includes(q) || i.altText.toLowerCase().includes(q));
  }, [items, query]);

  function handleChanged(id: number, item: MediaItem | null) {
    setItems((prev) => (item ? prev.map((i) => (i.id === id ? item : i)) : prev.filter((i) => i.id !== id)));
  }

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by filename or alt text..."
        className="w-full max-w-xs rounded-md border border-ink-300 px-3 py-1.5 text-xs focus:border-signal focus:outline-none"
      />
      {filtered.length === 0 ? (
        <p className="mt-6 text-sm text-ink-500">{items.length === 0 ? "No images uploaded yet." : "No images match your search."}</p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((item) => (
            <MediaCard key={item.id} item={item} onChanged={(next) => handleChanged(item.id, next)} />
          ))}
        </div>
      )}
    </div>
  );
}
