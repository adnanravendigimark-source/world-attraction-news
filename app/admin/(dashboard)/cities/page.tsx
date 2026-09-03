import type { Metadata } from "next";
import { getCities } from "@/lib/cities";
import { getArticleCountsByCity } from "@/lib/articles";
import CitiesManager from "@/components/admin/CitiesManager";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Destinations & Bureaus | World Attraction News Admin",
  robots: { index: false, follow: false },
};

export default async function AdminCitiesPage() {
  // A lightweight COUNT/GROUP BY, not a full getAllArticles() fetch (which
  // also re-runs publishDueScheduledArticles() as a side effect) — this page
  // only needs per-city totals, never the article rows themselves.
  const [cities, countsByCity] = await Promise.all([getCities(), getArticleCountsByCity()]);
  const counts: Record<string, { total: number; published: number }> = {};
  for (const city of cities) counts[city.id] = countsByCity[city.id] || { total: 0, published: 0 };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
          Destinations &amp; City Bureaus
        </h1>
        <p className="mt-0.5 text-xs sm:text-sm text-slate-500 font-medium">
          Manage destination bureaus, cover photography, intro overviews, and regional coverage.
        </p>
      </div>

      <CitiesManager initialCities={cities} articleCounts={counts} />
    </div>
  );
}
