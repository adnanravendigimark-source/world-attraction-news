import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import DestinationsClient, { DestinationCity, DestinationCountryData } from "./DestinationsClient";
import { getCitiesWithArticleCounts } from "@/lib/cities";
import { getAllCountries } from "@/lib/countries";
import { buildMetadata, breadcrumbJsonLd, itemListJsonLd, jsonLdScript } from "@/lib/seo";
import { countryPath } from "@/lib/destinations";
import { SITE_NAME } from "@/lib/site";

// Pure read, no searchParams (search/sort/filter is client-side over the
// full list) — real ISR. City & country counts change slowly enough that a wider
// window is safe; admin mutations call revalidatePath("/destinations").
export const revalidate = 300;

const getDestinationsPageData = unstable_cache(
  async () => {
    const [cities, countries] = await Promise.all([
      getCitiesWithArticleCounts(),
      getAllCountries(),
    ]);
    return { cities, countries };
  },
  ["destinations-page-data-v3"],
  { revalidate: 300, tags: ["cities", "countries"] }
);

export const metadata: Metadata = buildMetadata({
  title: `Destinations by Country — Global Attraction News & Travel Intelligence | ${SITE_NAME}`,
  description: "Explore destination countries and city bureaus for the latest attraction news, theme park updates, and travel dispatches.",
  path: "/destinations",
});

const breadcrumbs = [
  { name: "Home", path: "/" },
  { name: "Destinations", path: "/destinations" },
];

export default async function DestinationsPage() {
  const { cities, countries } = await getDestinationsPageData();

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
      <DestinationsClient dbCities={mappedCities} dbCountries={mappedCountries} />
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
