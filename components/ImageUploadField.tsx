"use client";

import { useState } from "react";
import Image from "next/image";

// Upload-only image field — no text input for pasting an external URL, by
// design (see product requirements: contributors must upload real files,
// never link out). Used by both the dashboard article form and the admin
// panel (city hero images, article cover edits).
export default function ImageUploadField({
  label,
  value,
  onChange,
  uploadUrl,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  uploadUrl: string;
}) {
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
      onChange(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</label>
      <div className="mt-1.5 flex items-start gap-3">
        {value ? (
          <div className="relative h-20 w-32 shrink-0 overflow-hidden rounded border border-slate-200 bg-slate-50">
            <Image src={value} alt="" fill className="object-cover" />
          </div>
        ) : (
          <div className="flex h-20 w-32 shrink-0 items-center justify-center rounded border border-dashed border-slate-300 bg-slate-50 text-[10px] text-slate-400">
            No image
          </div>
        )}
        <div>
          <label className="inline-flex cursor-pointer items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            {uploading ? "Uploading..." : value ? "Replace image" : "Upload image"}
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
          {error && <p className="mt-1.5 text-xs text-[#DC2626]">{error}</p>}
          <p className="mt-1.5 text-[10px] text-slate-400">JPG, PNG, or WebP. Automatically optimized on upload.</p>
        </div>
      </div>
    </div>
  );
}
