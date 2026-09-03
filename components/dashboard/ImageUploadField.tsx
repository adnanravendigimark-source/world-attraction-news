"use client";

import { useRef, useState } from "react";
import CropModal from "./CropModal";

export default function ImageUploadField({
  label,
  value,
  onChange,
  aspectRatio = 21 / 9,
  uploadUrl = "/api/dashboard/upload",
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  aspectRatio?: number;
  uploadUrl?: string;
}) {
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
      if (!res.ok) {
        setError(data.error || "Upload failed.");
      } else {
        onChange(data.url);
      }
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  function handleFileSelected(file: File) {
    if (aspectRatio) {
      setPendingFile({ file, url: URL.createObjectURL(file) });
    } else {
      upload(file);
    }
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

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-stone-700">{label}</label>
      {/* Upload-only, by design — no text input for pasting an external
          URL. Contributors upload real files; nothing is ever accepted as
          a pasted external image link (see lib/blob.ts's uploadImage). */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={uploading}
          className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-900 transition hover:bg-stone-100 disabled:opacity-60 cursor-pointer sm:w-auto"
        >
          {uploading ? "Uploading…" : value ? "Replace image" : "Upload image"}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileSelected(file);
            e.target.value = "";
          }}
        />
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {value && (
        <div className="mt-2 flex items-start gap-3 rounded-lg border border-stone-200 bg-stone-50 p-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="Preview"
            className="h-28 min-w-0 flex-1 rounded-lg border border-stone-200 object-cover"
          />
          <div className="flex shrink-0 flex-col gap-1.5">
            {aspectRatio && (
              <button
                type="button"
                onClick={() => setRecropSrc(value)}
                className="whitespace-nowrap rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-900 transition hover:bg-stone-100 cursor-pointer"
              >
                Adjust crop
              </button>
            )}
            <button
              type="button"
              onClick={() => onChange("")}
              className="whitespace-nowrap rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 cursor-pointer"
            >
              Remove image
            </button>
          </div>
        </div>
      )}

      {pendingFile && aspectRatio && (
        <CropModal
          src={pendingFile.url}
          aspectRatio={aspectRatio}
          onCancel={closePendingFile}
          onConfirm={handleCropConfirm}
          onUseOriginal={handleCropUseOriginal}
        />
      )}
      {recropSrc && aspectRatio && (
        <CropModal
          src={recropSrc}
          aspectRatio={aspectRatio}
          onCancel={() => setRecropSrc(null)}
          onConfirm={handleRecropConfirm}
        />
      )}
    </div>
  );
}
