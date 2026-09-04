import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import DestinationsClient, { DestinationCity } from "./DestinationsClient";
import { getCitiesWithArticleCounts } from "@/lib/cities";
import { getSettings } from "@/lib/settings";
import { buildMetadata, breadcrumbJsonLd, itemListJsonLd } from "@/lib/seo";
import { SITE_NAME } from "@/lib/site";

// Pure read, no searchParams (search/sort/filter is client-side over the
// full list) — real ISR. City counts change slowly enough that a wider
// window is safe; admin city create/edit/delete calls revalidatePath("/cities").
//
// `revalidate` alone doesn't achieve this: lib/db.ts's sql() issues every
// query with `fetchOptions: { cache: "no-store" }`, and a no-store fetch
// anywhere in a route's render forces the WHOLE route dynamic regardless of
// its own `revalidate` export. unstable_cache wraps the DB call's *return
// value* at the framework level, independent of the no-store fetch inside
// it, so this page can actually be served from cache between requests.
export const revalidate = 300;

const getCitiesPageData = unstable_cache(
  async () => {
    const [cities, settings] = await Promise.all([getCitiesWithArticleCounts(), getSettings()]);
    return { cities, settings };
  },
  ["cities-page-data"],
  { revalidate: 300, tags: ["cities", "settings"] }
);

export const metadata: Metadata = buildMetadata({
  title: `Destinations — Global Attraction News & Travel Updates | ${SITE_NAME}`,
  description: "Explore the latest attraction news and travel updates from the world's most iconic destinations.",
  path: "/cities",
});

const breadcrumbs = [
  { name: "Home", path: "/" },
  { name: "Destinations", path: "/cities" },
];

export default async function CitiesPage() {
  const { cities, settings } = await getCitiesPageData();
  const featuredSet = new Set(settings.featuredCitySlugs);

  const mappedCities: DestinationCity[] = cities.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    country: c.country,
    intro: c.intro,
    heroImage: c.heroImage,
    heroImageAlt: c.heroImageAlt || c.name,
    articleCount: c.articleCount,
    // "Popular" badge is admin-controlled (Admin -> Settings -> Featured
    // Cities), not a hardcoded slug list.
    isPopular: featuredSet.has(c.slug),
  }));

  return (
    <>
      <DestinationsClient dbCities={mappedCities} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            breadcrumbJsonLd(breadcrumbs),
            itemListJsonLd(cities.map((c) => ({ name: c.name, path: `/cities/${c.slug}` }))),
          ]),
        }}
      />
    </>
  );
}
