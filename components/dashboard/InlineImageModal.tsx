"use client";

import { useState } from "react";
import Image from "next/image";

export interface InlineImageData {
  url: string;
  alt: string;
  caption: string;
}

// The alt-text/caption editor for an image already placed in the article
// body (see RichTextEditor.tsx) — opens automatically right after a new
// image is uploaded (button, drag-drop, or paste), and again whenever the
// contributor clicks an existing image, so every inline image gets a real
// chance at alt text instead of silently going out blank.
//
// Upload-only, same as ImageUploadField — no field for pasting an external
// image URL. Every image in this app is either a real upload or nothing;
// contributors can't link out to someone else's hosted photo.
export default function InlineImageModal({
  initial,
  uploadUrl,
  onInsert,
  onRemove,
  onClose,
}: {
  initial?: InlineImageData;
  uploadUrl: string;
  onInsert: (data: InlineImageData) => void;
  onRemove?: () => void;
  onClose: () => void;
}) {
  const isEditing = Boolean(initial);
  const [url, setUrl] = useState(initial?.url || "");
  const [alt, setAlt] = useState(initial?.alt || "");
  const [caption, setCaption] = useState(initial?.caption || "");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(file: File) {
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(uploadUrl, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed.");
      setUrl(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  function handleSave() {
    if (!url) {
      setError("Add a photo first.");
      return;
    }
    onInsert({ url, alt: alt.trim(), caption: caption.trim() });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-bold text-slate-900">
          {isEditing ? "Edit Image" : "Insert Image"}
        </h3>
        <p className="mt-0.5 text-xs text-slate-500">
          {isEditing
            ? "Update the alt text or caption, replace the photo, or remove it."
            : "Upload a photo, then add alt text so it's accessible and SEO-friendly."}
        </p>

        <div className="mt-4 flex items-start gap-3">
          {url ? (
            <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
              <Image src={url} alt="" fill className="object-cover" />
            </div>
          ) : (
            <div className="flex h-20 w-28 shrink-0 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-[10px] text-slate-400 text-center px-1">
              No photo yet
            </div>
          )}
          <div className="min-w-0">
            <label className="inline-flex cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
              {uploading ? "Uploading..." : url ? "Replace photo" : "Upload photo"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                  e.target.value = "";
                }}
              />
            </label>
            {error && <p className="mt-1.5 text-xs text-rose-600">{error}</p>}
            <p className="mt-1.5 text-[10px] text-slate-400">JPG, PNG, or WebP.</p>
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-xs font-bold text-slate-700">
            Alt text <span className="text-slate-400 font-normal">(describes the photo for accessibility &amp; SEO)</span>
          </label>
          <input
            type="text"
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            placeholder="e.g. Crowds outside the Sagrada Familia at sunset"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#DC2626] focus:outline-none transition-all"
          />
        </div>

        <div className="mt-3">
          <label className="mb-1 block text-xs font-bold text-slate-700">
            Caption <span className="text-slate-400 font-normal">(optional, shown under the photo)</span>
          </label>
          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Shown under the photo in the published article"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#DC2626] focus:outline-none transition-all"
          />
        </div>

        <div className="mt-5 flex items-center justify-between gap-2">
          {isEditing && onRemove ? (
            <button
              type="button"
              onClick={onRemove}
              className="rounded-lg border border-rose-200 px-3.5 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
            >
              Remove from Article
            </button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!url || uploading}
              className="rounded-lg bg-[#DC2626] px-4 py-2 text-xs font-bold text-white hover:bg-[#B91C1C] transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isEditing ? "Save Changes" : "Insert Photo"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
