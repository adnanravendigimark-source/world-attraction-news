import type { Metadata } from "next";
import { getCities } from "@/lib/cities";
import { getCategories } from "@/lib/categories";
import { getFeaturedCitySlugs, getFeaturedCategorySlugs } from "@/lib/settings";
import HeaderManager from "@/components/admin/HeaderManager";
import AccessDenied from "@/components/admin/AccessDenied";
import { getSession } from "@/lib/session";
import { getEffectivePermissions, hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Header | World Attraction News Admin",
  robots: { index: false, follow: false },
};

export default async function AdminHeaderPage() {
  const session = await getSession();
  const effective = await getEffectivePermissions(session);
  if (!hasPermission(effective, "header", "read")) {
    return <AccessDenied pageLabel="Header" />;
  }

  const [cities, categories, featuredCitySlugs, featuredCategorySlugs] = await Promise.all([
    getCities(),
    getCategories(),
    getFeaturedCitySlugs(),
    getFeaturedCategorySlugs(),
  ]);

  return (
    <div className="space-y-5">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Header</h1>
        <p className="mt-0.5 text-xs sm:text-sm text-slate-500 font-medium">
          Choose which destinations and categories show in the public navbar&apos;s dropdowns.
        </p>
      </div>

      <HeaderManager
        allCities={cities.map((c) => ({ slug: c.slug, label: `${c.name}, ${c.country}` }))}
        allCategories={categories.map((c) => ({ slug: c.slug, label: c.name }))}
        initialFeaturedCitySlugs={featuredCitySlugs}
        initialFeaturedCategorySlugs={featuredCategorySlugs}
      />
    </div>
  );
}
