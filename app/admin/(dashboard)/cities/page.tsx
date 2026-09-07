import type { Metadata } from "next";
import { getCities } from "@/lib/cities";
import { getAllCountries } from "@/lib/countries";
import { getArticleCountsByCity } from "@/lib/articles";
import CitiesManager from "@/components/admin/CitiesManager";
import AccessDenied from "@/components/admin/AccessDenied";
import { getSession } from "@/lib/session";
import { getEffectivePermissions, hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Destinations & Bureaus | World Attraction News Admin",
  robots: { index: false, follow: false },
};

export default async function AdminCitiesPage() {
  const session = await getSession();
  const effective = await getEffectivePermissions(session);
  if (!hasPermission(effective, "destinations", "read")) {
    return <AccessDenied pageLabel="Destinations" />;
  }

  const [cities, countsByCity, countries] = await Promise.all([
    getCities(),
    getArticleCountsByCity(),
    getAllCountries(),
  ]);
  const counts: Record<string, { total: number; published: number }> = {};
  for (const city of cities) counts[city.id] = countsByCity[city.id] || { total: 0, published: 0 };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
          Destinations &amp; Bureaus
        </h1>
        <p className="mt-0.5 text-xs sm:text-sm text-slate-500 font-medium">
          Manage destination bureaus, country hubs, intro overviews, and regional coverage. Pick
          which destinations show in the public navbar from Admin -&gt; Header.
        </p>
      </div>

      <CitiesManager
        initialCities={cities}
        initialCountries={countries}
        articleCounts={counts}
      />
    </div>
  );
}
