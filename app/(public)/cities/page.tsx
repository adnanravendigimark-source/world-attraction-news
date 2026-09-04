import type { Metadata } from "next";
import DestinationsClient, { DestinationCity } from "./DestinationsClient";
import { getCitiesWithArticleCounts } from "@/lib/cities";
import { getSettings } from "@/lib/settings";
import { buildMetadata, breadcrumbJsonLd, itemListJsonLd } from "@/lib/seo";
import { SITE_NAME } from "@/lib/site";

// Pure read, no searchParams (search/sort/filter is client-side over the
// full list) — real ISR. City counts change slowly enough that a wider
// window is safe; admin city create/edit/delete calls revalidatePath("/cities").
export const revalidate = 300;

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
  const [cities, settings] = await Promise.all([getCitiesWithArticleCounts(), getSettings()]);
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
