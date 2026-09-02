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
    gaMeasurementId: initial.gaMeasurementId,
    gscVerificationCode: initial.gscVerificationCode,
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
      toast.success("SEO settings updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-ink-200/80 bg-white p-6 shadow-card space-y-5">
        <div className="border-b border-ink-100 pb-3">
          <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-signal">Meta Optimization</p>
          <h3 className="font-serif text-lg font-black text-ink-950">Global SEO Defaults</h3>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1.5">
            Default Search Snippet / Meta Description
          </label>
          <textarea
            value={form.defaultMetaDescription}
            onChange={(e) => setForm({ ...form, defaultMetaDescription: e.target.value })}
            rows={2}
            placeholder="Used as a global fallback description for social scrapers and search indexes..."
            className="w-full rounded-lg border border-ink-200 bg-paper-50 p-3 text-xs text-ink-800 focus:border-signal focus:outline-none resize-none leading-relaxed"
          />
        </div>

        <ImageUploadField
          label="Default Open Graph / Social Share Card (1200x630)"
          value={form.defaultOgImage}
          onChange={(url) => setForm({ ...form, defaultOgImage: url })}
          uploadUrl="/api/admin/upload"
        />

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1.5">
            Global Robots Indexing Directive
          </label>
          <select
            value={form.robotsDefault}
            onChange={(e) => setForm({ ...form, robotsDefault: e.target.value as "index" | "noindex" })}
            className="rounded-lg border border-ink-200 bg-paper-50 px-3 py-2 text-xs font-semibold"
          >
            <option value="index">Index, Follow (Recommended for search visibility)</option>
            <option value="noindex">Noindex, Nofollow (Staging / Private mode)</option>
          </select>
        </div>
      </div>

      <div className="rounded-2xl border border-ink-200/80 bg-white p-6 shadow-card space-y-5">
        <div className="border-b border-ink-100 pb-3">
          <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-signal">Telemetry</p>
          <h3 className="font-serif text-lg font-black text-ink-950">Analytics &amp; Search Console Verification</h3>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1.5">
              Google Analytics 4 Measurement ID
            </label>
            <input
              value={form.gaMeasurementId}
              onChange={(e) => setForm({ ...form, gaMeasurementId: e.target.value.trim() })}
              placeholder="G-XXXXXXXXXX"
              className="w-full rounded-lg border border-ink-200 bg-paper-50 px-3 py-2 text-xs font-mono focus:border-signal focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1.5">
              Google Search Console Verification Token
            </label>
            <input
              value={form.gscVerificationCode}
              onChange={(e) => setForm({ ...form, gscVerificationCode: e.target.value.trim() })}
              placeholder="google-site-verification token"
              className="w-full rounded-lg border border-ink-200 bg-paper-50 px-3 py-2 text-xs font-mono focus:border-signal focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div className="pt-2">
        <button
          disabled={busy}
          onClick={handleSave}
          className="rounded-xl bg-signal px-6 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-card hover:bg-signal-dark hover:shadow-lift transition-all disabled:opacity-60"
        >
          {busy ? "Saving..." : "Save SEO Settings"}
        </button>
      </div>
    </div>
  );
}
