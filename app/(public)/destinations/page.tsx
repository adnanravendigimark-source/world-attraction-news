import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import DestinationsClient, { DestinationCity, DestinationCountryData } from "./DestinationsClient";
import { getCitiesWithArticleCounts } from "@/lib/cities";
import { getAllCountries } from "@/lib/countries";
import { buildMetadata, breadcrumbJsonLd, itemListJsonLd, jsonLdScript } from "@/lib/seo";
import { countryPath } from "@/lib/destinations";
import { getStoryCountsByCountry } from "@/lib/articles";

// Pure read, no searchParams (search/sort/filter is client-side over the
// full list) — real ISR. City & country counts change slowly enough that a wider
// window is safe; admin mutations call revalidatePath("/destinations").
export const revalidate = 3600;

const getDestinationsPageData = unstable_cache(
  async () => {
    const [cities, countries, countryCounts] = await Promise.all([
      getCitiesWithArticleCounts(),
      getAllCountries(),
      getStoryCountsByCountry(),
    ]);
    return { cities, countries, countryCounts };
  },
  ["destinations-page-data-v4"],
  { revalidate: 3600, tags: ["cities", "countries", "articles"] }
);

export const metadata: Metadata = buildMetadata({
  title: "Destinations: Travel News & Guides by Country",
  description: "Browse travel news and guides by country and city.",
  path: "/destinations",
});

const breadcrumbs = [
  { name: "Home", path: "/" },
  { name: "Destinations", path: "/destinations" },
];

export default async function DestinationsPage() {
  const { cities, countries, countryCounts } = await getDestinationsPageData();

  const mappedCities: DestinationCity[] = cities.map((c) => ({
    id: c.id,
    slug: c.slug,
    countrySlug: c.countrySlug,
    name: c.name,
    country: c.country,
    intro: c.intro,
    heroImage: c.heroImage,
    heroImageAlt: c.heroImageAlt || c.name,
    articleCount: c.articleCount,
  }));

  const mappedCountries: DestinationCountryData[] = countries.map((co) => ({
    id: co.id,
    slug: co.slug,
    name: co.name,
    intro: co.intro,
    heroImage: co.heroImage,
    heroImageAlt: co.heroImageAlt || co.name,
  }));

  return (
    <>
      <DestinationsClient dbCities={mappedCities} dbCountries={mappedCountries} countryStoryCounts={countryCounts} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript([
            breadcrumbJsonLd(breadcrumbs),
            itemListJsonLd(countries.map((c) => ({ name: c.name, path: countryPath(c.slug) }))),
          ]),
        }}
      />
    </>
  );
}
