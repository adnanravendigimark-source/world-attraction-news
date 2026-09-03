import type { Metadata } from "next";
import { getCities } from "@/lib/cities";
import { getAllArticles } from "@/lib/articles";
import CitiesManager from "@/components/admin/CitiesManager";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Destinations & Bureaus | World Attraction News Admin",
  robots: { index: false, follow: false },
};

export default async function AdminCitiesPage() {
  const [cities, articles] = await Promise.all([getCities(), getAllArticles()]);

  const counts: Record<string, { total: number; published: number }> = {};
  for (const city of cities) counts[city.id] = { total: 0, published: 0 };
  for (const a of articles) {
    if (!counts[a.cityId]) counts[a.cityId] = { total: 0, published: 0 };
    counts[a.cityId].total++;
    if (a.status === "published") counts[a.cityId].published++;
  }

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
