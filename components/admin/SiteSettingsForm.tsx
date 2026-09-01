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
      toast.success("Site settings saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Homepage Intro Override</label>
        <textarea
          value={form.homepageIntroOverride}
          onChange={(e) => setForm({ ...form, homepageIntroOverride: e.target.value })}
          rows={3}
          placeholder="Leave blank to use the default homepage intro copy."
          className="mt-1.5 w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
        />
        <p className="mt-1 text-[11px] text-ink-400">When set, replaces the intro text under the homepage hero.</p>
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Featured Cities</label>
        <p className="mt-1 text-[11px] text-ink-400">Shown in the homepage's featured cities section, in the order selected.</p>
        {cities.length === 0 ? (
          <p className="mt-2 text-xs text-ink-400">No cities yet — add some in City Management first.</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            {cities.map((c) => {
              const active = form.featuredCitySlugs.includes(c.slug);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleCity(c.slug)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    active ? "border-signal bg-signal text-white" : "border-ink-300 bg-white text-ink-700 hover:bg-ink-50"
                  }`}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Content Moderation Note</label>
        <textarea
          value={form.moderationNote}
          onChange={(e) => setForm({ ...form, moderationNote: e.target.value })}
          rows={2}
          placeholder="Internal note shown to admins on the Article Review page — e.g. current review guidelines."
          className="mt-1.5 w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
        />
      </div>

      <button
        disabled={busy}
        onClick={handleSave}
        className="rounded-md bg-signal px-4 py-2 text-sm font-semibold text-white hover:bg-signal-dark disabled:opacity-60"
      >
        {busy ? "Saving..." : "Save Site Settings"}
      </button>
    </div>
  );
}
