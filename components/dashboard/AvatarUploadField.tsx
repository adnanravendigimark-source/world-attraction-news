"use client";

import { useState } from "react";
import Image from "next/image";

// Circular profile-photo picker — same upload-only rule as
// ImageUploadField (no pasting an external URL, ever), just presented as
// a round avatar with an overlay button instead of a rectangular card,
// since that's the natural shape for a profile photo.
export default function AvatarUploadField({
  value,
  onChange,
  displayName,
}: {
  value: string;
  onChange: (url: string) => void;
  displayName: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const initials = displayName.trim().slice(0, 2).toUpperCase() || "?";

  async function handleFile(file: File) {
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/dashboard/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed.");
      onChange(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="group relative h-20 w-20 shrink-0">
        <div className="h-20 w-20 overflow-hidden rounded-full border-2 border-white bg-slate-900 shadow-2xs ring-1 ring-slate-200">
          {value ? (
            <Image src={value} alt="" width={80} height={80} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xl font-bold text-white">
              {initials}
            </div>
          )}
        </div>
        <label
          className={`absolute inset-0 flex cursor-pointer items-center justify-center rounded-full bg-slate-950/60 text-[10px] font-bold uppercase tracking-wide text-white opacity-0 transition-opacity group-hover:opacity-100 ${
            uploading ? "opacity-100" : ""
          }`}
        >
          {uploading ? "..." : "Change"}
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
      </div>
      <div>
        <label className="inline-flex cursor-pointer items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
          {uploading ? "Uploading..." : value ? "Replace photo" : "Upload photo"}
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
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="ml-2 text-xs font-semibold text-slate-400 hover:text-[#DC2626]"
          >
            Remove
          </button>
        )}
        {error && <p className="mt-1.5 text-xs text-[#DC2626]">{error}</p>}
        <p className="mt-1.5 text-[10px] text-slate-400">JPG, PNG, or WebP. Square photos look best.</p>
      </div>
    </div>
  );
}
