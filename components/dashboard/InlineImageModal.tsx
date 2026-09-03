"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import InlineCropModal from "@/components/dashboard/InlineCropModal";

export interface InlineImageData {
  url: string;
  alt: string;
  caption: string;
}

// The image insert/edit dialog for the article body — same design and flow
// as the Sagrada/Amsterdam admin editor's RichImageModal (upload, paste a
// URL, crop, alt text, caption), minus the Media Library button (no
// contributor-facing media browser exists in this app). Opens automatically
// right after clicking the toolbar's Image button, or when clicking an
// existing image in the body to edit/replace/remove it.
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
  const fileInput = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<{ file: File; url: string } | null>(null);
  const [recropSrc, setRecropSrc] = useState<string | null>(null);

  async function upload(file: File | Blob, name = "image.jpg") {
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file, file instanceof File ? file.name : name);
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

  function handleFileSelected(file: File) {
    setPendingFile({ file, url: URL.createObjectURL(file) });
  }

  function closePendingFile() {
    if (pendingFile) URL.revokeObjectURL(pendingFile.url);
    setPendingFile(null);
  }

  function handleCropConfirm(blob: Blob) {
    closePendingFile();
    upload(blob, "cropped.jpg");
  }

  function handleCropUseOriginal() {
    if (!pendingFile) return;
    const file = pendingFile.file;
    closePendingFile();
    upload(file);
  }

  function handleRecropConfirm(blob: Blob) {
    setRecropSrc(null);
    upload(blob, "cropped.jpg");
  }

  function handleSave() {
    if (!url) {
      setError("Add a photo first — upload a file or paste a URL.");
      return;
    }
    onInsert({ url, alt: alt.trim(), caption: caption.trim() });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">
            {isEditing ? "Edit Image Details" : "Insert image"}
          </h3>
          {isEditing && (
            <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-[#DC2626]">
              Editing Image
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {isEditing
            ? "Update the alt text (for SEO), caption, or replace the photo."
            : "Upload a photo from your device, or paste an image URL."}
        </p>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://... or upload a file"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#DC2626] focus:outline-none focus:ring-1 focus:ring-[#DC2626]"
          />
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={uploading}
            className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
          >
            {uploading ? "Uploading…" : "Upload"}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelected(file);
              e.target.value = "";
            }}
          />
        </div>
        {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}

        {url && (
          <div className="mt-3 flex items-start gap-2">
            <div className="relative h-28 min-w-0 flex-1 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
              <Image src={url} alt="Preview" fill className="object-cover" unoptimized />
            </div>
            <div className="flex shrink-0 flex-col gap-1.5">
              <button
                type="button"
                onClick={() => setRecropSrc(url)}
                className="whitespace-nowrap rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 cursor-pointer"
              >
                Adjust crop
              </button>
              <button
                type="button"
                onClick={() => setUrl("")}
                className="whitespace-nowrap rounded-lg border border-rose-200 px-3 py-2 text-xs font-medium text-rose-600 transition hover:bg-rose-50 cursor-pointer"
              >
                Change photo
              </button>
            </div>
          </div>
        )}

        <div className="mt-3">
          <label className="mb-1 block text-xs font-medium text-slate-700">
            Alt text <span className="text-slate-400">(important for SEO &amp; Google Images)</span>
          </label>
          <input
            type="text"
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            placeholder="Describe what is shown in the image (e.g. Crowds outside the Sagrada Familia at sunset)"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#DC2626] focus:outline-none focus:ring-1 focus:ring-[#DC2626]"
          />
        </div>

        <div className="mt-3">
          <label className="mb-1 block text-xs font-medium text-slate-700">
            Caption <span className="text-slate-400">(optional, displayed under the image)</span>
          </label>
          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Shown under the photo on the article"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#DC2626] focus:outline-none focus:ring-1 focus:ring-[#DC2626]"
          />
        </div>

        <div className="mt-5 flex items-center justify-between gap-2">
          {isEditing && onRemove ? (
            <button
              type="button"
              onClick={onRemove}
              className="rounded-lg border border-rose-200 px-3.5 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50 cursor-pointer"
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
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!url || uploading}
              className="rounded-lg bg-gradient-to-r from-[#F43F5E] to-[#E11D48] px-4 py-2 text-sm font-bold text-white transition shadow-sm disabled:opacity-60 cursor-pointer"
            >
              {isEditing ? "Save changes" : "Insert image"}
            </button>
          </div>
        </div>
      </div>

      {pendingFile && (
        <InlineCropModal
          src={pendingFile.url}
          aspectRatio={16 / 9}
          onCancel={closePendingFile}
          onConfirm={handleCropConfirm}
          onUseOriginal={handleCropUseOriginal}
        />
      )}
      {recropSrc && (
        <InlineCropModal
          src={recropSrc}
          aspectRatio={16 / 9}
          onCancel={() => setRecropSrc(null)}
          onConfirm={handleRecropConfirm}
        />
      )}
    </div>
  );
}
