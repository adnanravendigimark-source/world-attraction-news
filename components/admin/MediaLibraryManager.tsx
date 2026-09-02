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
        title: "Delete this image from media library?",
        description: "This removes the file and cannot be undone.",
        confirmLabel: "Delete Media",
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
      if (!res.ok) throw new Error(data.error || "Couldn't delete image.");
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
      setUsagePanel({ loading: false, usage: data.usage });
    } catch {
      setUsagePanel(null);
      toast.error("Couldn't fetch usage data.");
    }
  }

  function handleReplaceClick() {
    fileInputRef.current?.click();
  }

  async function handleReplaceFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setReplacing(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/admin/media/${item.id}/replace`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Replacement failed.");
      onChanged(data.item);
      toast.success("Image file replaced.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to replace image.");
    } finally {
      setReplacing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="group rounded-2xl border border-ink-200/80 bg-white overflow-hidden shadow-card transition-all hover:shadow-lift">
      <div
        className="relative aspect-video w-full cursor-pointer bg-paper-100 overflow-hidden"
        onClick={() => onPreview(item)}
      >
        <Image
          src={item.url}
          alt={item.altText || item.filename}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </div>

      <div className="p-4 space-y-2">
        <p className="truncate text-xs font-bold text-ink-950 font-serif" title={item.filename}>
          {item.filename.split("/").pop()}
        </p>
        <p className="font-mono text-[10px] text-ink-400">
          {formatBytes(item.sizeBytes)}
          {item.width && item.height ? ` · ${item.width}×${item.height}` : ""} · {formatDate(item.createdAt)}
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleReplaceFile}
        />

        {usageWarning && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-2.5 text-[11px] text-amber-900">
            <p className="font-bold">Image is active in:</p>
            <ul className="mt-1 list-disc pl-4 space-y-0.5">
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
                className="rounded-lg bg-signal px-2 py-1 text-[10px] font-bold text-white hover:bg-signal-dark"
              >
                Force Delete
              </button>
              <button
                onClick={() => setUsageWarning(null)}
                className="rounded-lg border border-amber-300 px-2 py-1 text-[10px] font-bold text-amber-900"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {usagePanel && (
          <div className="rounded-xl border border-ink-200 bg-paper-100 p-2.5 text-[11px] text-ink-700">
            {usagePanel.loading ? (
              <p className="text-ink-400 font-mono text-[10px]">Scanning articles...</p>
            ) : usagePanel.usage && usageLines(usagePanel.usage).length > 0 ? (
              <ul className="list-disc pl-4 space-y-0.5">
                {usageLines(usagePanel.usage).map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            ) : (
              <p className="text-ink-400">Not linked in any live articles.</p>
            )}
          </div>
        )}

        {editing ? (
          <div className="space-y-2 pt-2 border-t border-ink-100">
            <input
              value={altText}
              onChange={(e) => setAltText(e.target.value)}
              placeholder="Alt text"
              className="w-full rounded-lg border border-ink-200 px-2 py-1 text-xs"
            />
            <input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Caption / Credit"
              className="w-full rounded-lg border border-ink-200 px-2 py-1 text-xs"
            />
            <div className="flex gap-2">
              <button
                disabled={busy}
                onClick={saveMeta}
                className="rounded-lg bg-ink-950 px-2.5 py-1 text-xs font-bold text-white hover:bg-signal"
              >
                Save
              </button>
              <button
                onClick={() => setEditing(false)}
                className="rounded-lg border border-ink-200 px-2.5 py-1 text-xs font-bold text-ink-700"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-ink-100">
            <button
              onClick={() => setEditing(true)}
              className="rounded-lg border border-ink-200 bg-paper-50 px-2.5 py-1 text-[11px] font-bold text-ink-700 hover:bg-paper-100"
            >
              Edit Meta
            </button>
            <button
              onClick={handleReplaceClick}
              disabled={replacing}
              className="rounded-lg border border-ink-200 bg-paper-50 px-2.5 py-1 text-[11px] font-bold text-ink-700 hover:bg-paper-100 disabled:opacity-50"
            >
              Replace
            </button>
            <button
              onClick={handleCheckUsage}
              className="rounded-lg border border-ink-200 bg-paper-50 px-2.5 py-1 text-[11px] font-bold text-ink-700 hover:bg-paper-100"
            >
              {usagePanel ? "Hide Usage" : "Usage"}
            </button>
            <button
              disabled={busy}
              onClick={() => handleDelete(false)}
              className="ml-auto rounded-lg px-2 py-1 text-[11px] font-bold text-ink-400 hover:text-signal"
            >
              Delete
            </button>
          </div>
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
    return items.filter(
      (i) =>
        i.filename.toLowerCase().includes(q) ||
        i.altText.toLowerCase().includes(q) ||
        i.caption.toLowerCase().includes(q)
    );
  }, [items, query]);

  function handleChanged(id: number, item: MediaItem | null) {
    setItems((prev) => (item ? prev.map((i) => (i.id === id ? item : i)) : prev.filter((i) => i.id !== id)));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-ink-100 pb-4">
        <div>
          <h2 className="font-serif text-xl font-black text-ink-950">Editorial Media Vault ({items.length})</h2>
          <p className="mt-0.5 text-xs text-ink-500">Asset library, photo credits, and usage trackers across all dispatches.</p>
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search media by filename, alt text..."
          className="w-full sm:w-64 rounded-xl border border-ink-200 bg-white px-3 py-1.5 text-xs focus:border-signal focus:outline-none"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-300 bg-white p-12 text-center text-xs text-ink-500">
          {items.length === 0 ? "No media assets uploaded yet." : "No images match your search."}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((item) => (
            <MediaCard
              key={item.id}
              item={item}
              onChanged={(next) => handleChanged(item.id, next)}
              onPreview={setPreviewItem}
            />
          ))}
        </div>
      )}

      {previewItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-xs"
          onClick={() => setPreviewItem(null)}
        >
          <div
            className="max-h-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative aspect-video w-full max-w-4xl bg-ink-950">
              <Image
                src={previewItem.url}
                alt={previewItem.altText || previewItem.filename}
                fill
                className="object-contain"
              />
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-ink-100 px-6 py-4">
              <div className="min-w-0">
                <p className="truncate font-serif text-sm font-bold text-ink-950">
                  {previewItem.filename.split("/").pop()}
                </p>
                <p className="font-mono text-xs text-ink-400">
                  {formatBytes(previewItem.sizeBytes)}
                  {previewItem.width && previewItem.height ? ` · ${previewItem.width}×${previewItem.height}px` : ""}
                </p>
              </div>
              <button
                onClick={() => setPreviewItem(null)}
                className="rounded-xl border border-ink-200 bg-paper-50 px-4 py-2 text-xs font-bold text-ink-800 hover:bg-paper-100"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
