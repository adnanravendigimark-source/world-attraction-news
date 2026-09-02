"use client";

import { useState } from "react";
import type { SiteSettings } from "@/lib/settings";
import type { City } from "@/lib/cities";
import { useToast } from "@/components/ToastProvider";

export default function SiteSettingsForm({ initial, cities }: { initial: SiteSettings; cities: City[] }) {
  const toast = useToast();
  const [form, setForm] = useState({
    homepageIntroOverride: initial.homepageIntroOverride,
    featuredCitySlugs: initial.featuredCitySlugs,
    moderationNote: initial.moderationNote,
  });
  const [busy, setBusy] = useState(false);

  function toggleCity(slug: string) {
    setForm((f) => ({
      ...f,
      featuredCitySlugs: f.featuredCitySlugs.includes(slug)
        ? f.featuredCitySlugs.filter((s) => s !== slug)
        : [...f.featuredCitySlugs, slug],
    }));
  }

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
      toast.success("Publication settings saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-ink-200/80 bg-white p-6 shadow-card space-y-4">
        <div className="border-b border-ink-100 pb-3">
          <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-signal">Editorial Hero</p>
          <h3 className="font-serif text-lg font-black text-ink-950">Homepage Intro Override</h3>
        </div>
        <textarea
          value={form.homepageIntroOverride}
          onChange={(e) => setForm({ ...form, homepageIntroOverride: e.target.value })}
          rows={3}
          placeholder="Leave blank to use default publication mission statement..."
          className="w-full rounded-lg border border-ink-200 bg-paper-50 p-3 text-xs text-ink-800 focus:border-signal focus:outline-none resize-none leading-relaxed"
        />
      </div>

      <div className="rounded-2xl border border-ink-200/80 bg-white p-6 shadow-card space-y-4">
        <div className="border-b border-ink-100 pb-3">
          <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-signal">Curated Bureaus</p>
          <h3 className="font-serif text-lg font-black text-ink-950">Featured Destination Bureaus</h3>
        </div>
        <p className="text-xs text-ink-500">Pick which destination bureaus appear prominently on the homepage.</p>
        <div className="flex flex-wrap gap-2">
          {cities.map((c) => {
            const active = form.featuredCitySlugs.includes(c.slug);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleCity(c.slug)}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-bold transition-all ${
                  active
                    ? "border-signal bg-signal text-white shadow-card"
                    : "border-ink-200 bg-paper-50 text-ink-700 hover:border-ink-400"
                }`}
              >
                {c.name} {active ? "✓" : "+"}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-ink-200/80 bg-white p-6 shadow-card space-y-4">
        <div className="border-b border-ink-100 pb-3">
          <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-signal">Editorial Guidelines</p>
          <h3 className="font-serif text-lg font-black text-ink-950">Internal Newsroom Rubric Note</h3>
        </div>
        <textarea
          value={form.moderationNote}
          onChange={(e) => setForm({ ...form, moderationNote: e.target.value })}
          rows={2}
          placeholder="Guidance note displayed to editors on the review workbench..."
          className="w-full rounded-lg border border-ink-200 bg-paper-50 p-3 text-xs text-ink-800 focus:border-signal focus:outline-none resize-none"
        />
      </div>

      <div className="pt-2">
        <button
          disabled={busy}
          onClick={handleSave}
          className="rounded-xl bg-signal px-6 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-card hover:bg-signal-dark hover:shadow-lift transition-all disabled:opacity-60"
        >
          {busy ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
