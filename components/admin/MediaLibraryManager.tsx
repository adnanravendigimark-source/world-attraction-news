"use client";

import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import type { MediaItem, MediaUsage } from "@/lib/media";
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

function usageLines(usage: MediaUsage): string[] {
  const lines: string[] = [];
  usage.cityHero.forEach((c) => lines.push(`City hero: ${c.name}`));
  usage.attractionHero.forEach((a) => lines.push(`Attraction hero: ${a.name}`));
  usage.articleCover.forEach((a) => lines.push(`Article cover: ${a.title}`));
  usage.articleContent.forEach((a) => lines.push(`In content: ${a.title}`));
  return lines;
}

function MediaCard({
  item,
  onChanged,
  onPreview,
}: {
  item: MediaItem;
  onChanged: (item: MediaItem | null) => void;
  onPreview: (item: MediaItem) => void;
}) {
  const confirm = useConfirm();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [altText, setAltText] = useState(item.altText);
  const [caption, setCaption] = useState(item.caption);
  const [busy, setBusy] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [usageWarning, setUsageWarning] = useState<MediaUsage | null>(null);
  const [usagePanel, setUsagePanel] = useState<{ loading: boolean; usage: MediaUsage | null } | null>(null);

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

  async function handleCheckUsage() {
    if (usagePanel) {
      setUsagePanel(null);
      return;
    }
    setUsagePanel({ loading: true, usage: null });
    try {
      const res = await fetch(`/api/admin/media/${item.id}/usage`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't check usage.");
      setUsagePanel({ loading: false, usage: data.usage });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't check usage.");
      setUsagePanel(null);
    }
  }

  function handleReplaceClick() {
    fileInputRef.current?.click();
  }

  async function handleReplaceFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const lines = usageLines(await fetchUsagePreview());
    const ok = await confirm({
      title: "Replace this image?",
      description:
        lines.length > 0
          ? `The new file will take over every place this image is used, including: ${lines.join(", ")}.`
          : "This uploads a new file and permanently removes the current one. It isn't currently referenced anywhere.",
      confirmLabel: "Replace",
      danger: true,
    });
    if (!ok) return;

    setReplacing(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(`/api/admin/media/${item.id}/replace`, { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't replace image.");
      onChanged(data.item);
      toast.success("Image replaced everywhere it was used.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't replace image.");
    } finally {
      setReplacing(false);
    }
  }

  async function fetchUsagePreview(): Promise<MediaUsage> {
    try {
      const res = await fetch(`/api/admin/media/${item.id}/usage`);
      const data = await res.json();
      if (res.ok) return data.usage;
    } catch {
      // fall through to empty usage — confirm dialog will just say "not referenced"
    }
    return { cityHero: [], attractionHero: [], articleCover: [], articleContent: [] };
  }

  return (
    <div className="overflow-hidden rounded-lg border border-ink-200 bg-white">
      <button
        type="button"
        onClick={() => onPreview(item)}
        className="relative block aspect-video w-full bg-ink-50"
        aria-label="Preview image"
      >
        <Image src={item.url} alt={item.altText || item.filename} fill className="object-cover" />
        {replacing && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-[11px] font-semibold text-ink-600">
            Replacing...
          </div>
        )}
      </button>
      <div className="p-3">
        <p className="truncate text-xs font-semibold text-ink-800" title={item.filename}>
          {item.filename.split("/").pop()}
        </p>
        <p className="mt-0.5 text-[10px] text-ink-400">
          {formatBytes(item.sizeBytes)}
          {item.width && item.height ? ` · ${item.width}×${item.height}` : ""} · {formatDate(item.createdAt)}
        </p>

        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleReplaceFile} />

        {usageWarning && (
          <div className="mt-2 rounded border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-900">
            <p className="font-semibold">Still in use:</p>
            <ul className="mt-1 list-disc pl-4">
              {usageLines(usageWarning).map((line, i) => (
                <li key={i}>{line}</li>
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

        {usagePanel && (
          <div className="mt-2 rounded border border-ink-200 bg-ink-50 p-2 text-[11px] text-ink-700">
            {usagePanel.loading ? (
              <p className="text-ink-400">Checking...</p>
            ) : usagePanel.usage && usageLines(usagePanel.usage).length > 0 ? (
              <ul className="list-disc pl-4">
                {usageLines(usagePanel.usage).map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            ) : (
              <p className="text-ink-400">Not currently used anywhere.</p>
            )}
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
              <button onClick={handleReplaceClick} disabled={replacing} className="rounded border border-ink-300 px-2 py-1 text-[11px] font-semibold text-ink-700 hover:bg-ink-50 disabled:opacity-50">
                Replace
              </button>
              <button onClick={handleCheckUsage} className="rounded border border-ink-300 px-2 py-1 text-[11px] font-semibold text-ink-700 hover:bg-ink-50">
                {usagePanel ? "Hide usage" : "Where used?"}
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
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.trim().toLowerCase();
    return items.filter((i) => i.filename.toLowerCase().includes(q) || i.altText.toLowerCase().includes(q) || i.caption.toLowerCase().includes(q));
  }, [items, query]);

  function handleChanged(id: number, item: MediaItem | null) {
    setItems((prev) => (item ? prev.map((i) => (i.id === id ? item : i)) : prev.filter((i) => i.id !== id)));
  }

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by filename, alt text, or caption..."
        className="w-full max-w-xs rounded-md border border-ink-300 px-3 py-1.5 text-xs focus:border-signal focus:outline-none"
      />
      {filtered.length === 0 ? (
        <p className="mt-6 text-sm text-ink-500">{items.length === 0 ? "No images uploaded yet." : "No images match your search."}</p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((item) => (
            <MediaCard key={item.id} item={item} onChanged={(next) => handleChanged(item.id, next)} onPreview={setPreviewItem} />
          ))}
        </div>
      )}

      {previewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6" onClick={() => setPreviewItem(null)}>
          <div className="max-h-full max-w-3xl overflow-hidden rounded-lg bg-white" onClick={(e) => e.stopPropagation()}>
            <div className="relative aspect-video w-full max-w-3xl bg-ink-50">
              <Image src={previewItem.url} alt={previewItem.altText || previewItem.filename} fill className="object-contain" />
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-ink-100 px-4 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-ink-800">{previewItem.filename.split("/").pop()}</p>
                <p className="text-[11px] text-ink-400">
                  {formatBytes(previewItem.sizeBytes)}
                  {previewItem.width && previewItem.height ? ` · ${previewItem.width}×${previewItem.height}` : ""}
                </p>
              </div>
              <button onClick={() => setPreviewItem(null)} className="shrink-0 rounded border border-ink-300 px-2.5 py-1 text-[11px] font-semibold text-ink-700 hover:bg-ink-50">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
