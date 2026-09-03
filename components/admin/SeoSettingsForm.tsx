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
      toast.success("SEO settings saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-2xs space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#DC2626]">HOMEPAGE FALLBACKS</span>
          <h3 className="text-sm font-bold text-slate-900 mt-0.5">Meta Defaults</h3>
          <p className="mt-1 text-xs text-slate-500">
            Used only on the homepage, and only when nothing more specific is set. Every article and city already has
            its own meta title, description, and focus keyword.
          </p>
        </div>

        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1.5">
            Default Meta Description
          </label>
          <textarea
            value={form.defaultMetaDescription}
            onChange={(e) => setForm({ ...form, defaultMetaDescription: e.target.value })}
            rows={2}
            placeholder="Fallback description for search engines and social previews of the homepage..."
            className="w-full rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-800 focus:border-[#DC2626] focus:outline-none resize-none leading-relaxed"
          />
        </div>

        <ImageUploadField
          label="Default Open Graph / Social Share Image (1200×630)"
          value={form.defaultOgImage}
          onChange={(url) => setForm({ ...form, defaultOgImage: url })}
          uploadUrl="/api/admin/upload"
        />

        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1.5">
            Homepage Robots Directive
          </label>
          <select
            value={form.robotsDefault}
            onChange={(e) => setForm({ ...form, robotsDefault: e.target.value as "index" | "noindex" })}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-[#DC2626] focus:outline-none cursor-pointer"
          >
            <option value="index">Index, Follow (recommended)</option>
            <option value="noindex">Noindex, Nofollow (staging / private mode)</option>
          </select>
          <p className="mt-1.5 text-[10px] text-slate-400">
            Only affects the homepage's own meta tag — not /robots.txt, the sitemap, or any other page.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-2xs space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#DC2626]">SITEWIDE</span>
          <h3 className="text-sm font-bold text-slate-900 mt-0.5">Analytics &amp; Search Console</h3>
          <p className="mt-1 text-xs text-slate-500">
            Both stay completely inert — no script loads, no tag renders — until you set a real value here.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Google Analytics 4 Measurement ID
            </label>
            <input
              value={form.gaMeasurementId}
              onChange={(e) => setForm({ ...form, gaMeasurementId: e.target.value.trim() })}
              placeholder="G-XXXXXXXXXX"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-mono text-slate-800 focus:border-[#DC2626] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Google Search Console Verification
            </label>
            <input
              value={form.gscVerificationCode}
              onChange={(e) => setForm({ ...form, gscVerificationCode: e.target.value.trim() })}
              placeholder="google-site-verification token"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-mono text-slate-800 focus:border-[#DC2626] focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div>
        <button
          type="button"
          disabled={busy}
          onClick={handleSave}
          className="rounded-xl bg-[#DC2626] px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-2xs hover:bg-[#B91C1C] transition-all disabled:opacity-60 cursor-pointer"
        >
          {busy ? "Saving..." : "Save SEO Settings"}
        </button>
      </div>
    </div>
  );
}
