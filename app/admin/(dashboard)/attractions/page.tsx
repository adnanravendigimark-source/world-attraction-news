import type { Metadata } from "next";
import { getCities } from "@/lib/cities";
import { getAttractions, getArticleCountsByAttraction } from "@/lib/attractions";
import AttractionsManager from "@/components/admin/AttractionsManager";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Attractions & Landmarks | World Attraction News Admin",
  robots: { index: false, follow: false },
};

export default async function AdminAttractionsPage() {
  // Every status counts here (not just published) — this number also gates
  // deletion in AttractionsManager's handleDelete.
  const [cities, attractions, counts] = await Promise.all([
    getCities(),
    getAttractions(),
    getArticleCountsByAttraction(),
  ]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
          Attractions &amp; Landmark Venues
        </h1>
        <p className="mt-0.5 text-xs sm:text-sm text-slate-500 font-medium">
          Manage theme parks, historic landmarks, observation decks, museums, and venues.
        </p>
      </div>

      <AttractionsManager initialAttractions={attractions} cities={cities} articleCounts={counts} />
    </div>
  );
}
