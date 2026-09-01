import type { Metadata } from "next";
import { getCities } from "@/lib/cities";
import { getAllArticles } from "@/lib/articles";
import CitiesManager from "@/components/admin/CitiesManager";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Cities", robots: { index: false, follow: false } };

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
    <div>
      <h1 className="font-serif text-2xl font-bold text-ink-900">Cities</h1>
      <p className="mt-1 text-sm text-ink-600">
        Every article and contributor is assigned to one of these cities. Deleting a city is blocked while it still
        has articles or contributors assigned.
      </p>
      <div className="mt-6">
        <CitiesManager initialCities={cities} articleCounts={counts} />
      </div>
    </div>
  );
}
