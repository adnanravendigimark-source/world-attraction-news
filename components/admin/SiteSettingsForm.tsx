"use client";

import { useState } from "react";
import type { SiteSettings } from "@/lib/settings";
import type { City } from "@/lib/cities";
import { useToast } from "@/components/ToastProvider";

export default function SiteSettingsForm({ initial, cities }: { initial: SiteSettings; cities: City[] }) {
  const toast = useToast();
  const [featuredCitySlugs, setFeaturedCitySlugs] = useState<string[]>(initial.featuredCitySlugs);
  const [busy, setBusy] = useState(false);

  function toggleCity(slug: string) {
    setFeaturedCitySlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  }

  async function handleSave() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ featuredCitySlugs }),
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
    <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-2xs space-y-4">
      <div className="border-b border-slate-100 pb-3">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#DC2626]">HOMEPAGE</span>
        <h3 className="text-sm font-bold text-slate-900 mt-0.5">Featured Destinations</h3>
        <p className="mt-1 text-xs text-slate-500">
          Pick which destinations get a "Popular" badge and priority placement on the public /destinations page.
        </p>
      </div>

      {cities.length === 0 ? (
        <p className="text-xs text-slate-400">No destinations exist yet — add one from Admin → Destinations first.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {cities.map((c) => {
            const active = featuredCitySlugs.includes(c.slug);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleCity(c.slug)}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                  active
                    ? "border-[#DC2626] bg-[#DC2626] text-white shadow-2xs"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                }`}
              >
                {c.name} {active ? "✓" : "+"}
              </button>
            );
          })}
        </div>
      )}

      <div className="pt-2 border-t border-slate-100">
        <button
          type="button"
          disabled={busy}
          onClick={handleSave}
          className="rounded-xl bg-[#DC2626] px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-2xs hover:bg-[#B91C1C] transition-all disabled:opacity-60 cursor-pointer"
        >
          {busy ? "Saving..." : "Save Site Settings"}
        </button>
      </div>
    </div>
  );
}
