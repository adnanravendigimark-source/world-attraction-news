"use client";

import { useState } from "react";
import type { SiteSettings } from "@/lib/settings";
import ImageUploadField from "@/components/ImageUploadField";
import { useToast } from "@/components/ToastProvider";

export default function SeoSettingsForm({ initial }: { initial: SiteSettings }) {
  const toast = useToast();
  const [form, setForm] = useState({
    defaultMetaDescription: initial.defaultMetaDescription,
    defaultOgImage: initial.defaultOgImage,
    robotsDefault: initial.robotsDefault,
  });
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      toast.success("SEO settings saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Default Meta Description</label>
        <textarea
          value={form.defaultMetaDescription}
          onChange={(e) => setForm({ ...form, defaultMetaDescription: e.target.value })}
          rows={2}
          placeholder="Used as a fallback wherever a page doesn't set its own description."
          className="mt-1.5 w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
        />
      </div>

      <ImageUploadField
        label="Default Open Graph / Social Share Image"
        value={form.defaultOgImage}
        onChange={(url) => setForm({ ...form, defaultOgImage: url })}
        uploadUrl="/api/admin/upload"
      />

      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Default Robots Directive</label>
        <select
          value={form.robotsDefault}
          onChange={(e) => setForm({ ...form, robotsDefault: e.target.value as "index" | "noindex" })}
          className="mt-1.5 w-full max-w-xs rounded-md border border-ink-300 bg-white px-3 py-2 text-sm"
        >
          <option value="index">Index, Follow (default)</option>
          <option value="noindex">Noindex, Nofollow</option>
        </select>
        <p className="mt-1 text-[11px] text-ink-400">
          Applies only where a page doesn't already set its own robots directive. Dashboard and Admin pages are
          always noindex regardless of this setting.
        </p>
      </div>

      <button
        disabled={busy}
        onClick={handleSave}
        className="rounded-md bg-signal px-4 py-2 text-sm font-semibold text-white hover:bg-signal-dark disabled:opacity-60"
      >
        {busy ? "Saving..." : "Save SEO Settings"}
      </button>
    </div>
  );
}
