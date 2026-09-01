import type { Metadata } from "next";
import { getCities } from "@/lib/cities";
import { getAttractions, getPublishedArticleCountsByAttraction } from "@/lib/attractions";
import AttractionsManager from "@/components/admin/AttractionsManager";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Attractions", robots: { index: false, follow: false } };

export default async function AdminAttractionsPage() {
  const [cities, attractions, counts] = await Promise.all([
    getCities(),
    getAttractions(),
    getPublishedArticleCountsByAttraction(),
  ]);

  return (
    <div>
      <h1 className="font-serif text-2xl font-bold text-ink-900">Attractions</h1>
      <p className="mt-1 text-sm text-ink-600">
        City → Attraction → Article. Every attraction belongs to one city; contributors can optionally tag an article
        to a specific attraction (e.g. Amsterdam → Rijksmuseum) instead of just the city.
      </p>
      <div className="mt-6">
        <AttractionsManager initialAttractions={attractions} cities={cities} articleCounts={counts} />
      </div>
    </div>
  );
}
