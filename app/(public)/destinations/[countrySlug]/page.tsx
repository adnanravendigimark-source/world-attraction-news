import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { unstable_cache } from "next/cache";
import { getCitiesByCountrySlug, getCityBySlug } from "@/lib/cities";
import { getCountryBySlug } from "@/lib/countries";
import { getPublishedArticles, getPublishedArticleByAnySlug } from "@/lib/articles";
import { buildMetadata, breadcrumbJsonLd, itemListJsonLd, jsonLdScript } from "@/lib/seo";
import { cityPath, countryPath, articlePath } from "@/lib/destinations";
import { SITE_NAME } from "@/lib/site";
import CountryClient from "./CountryClient";

export const revalidate = 300;

const getCachedCountryData = unstable_cache(
  async (countrySlug: string) => {
    const [cities, country, articles] = await Promise.all([
      getCitiesByCountrySlug(countrySlug),
      getCountryBySlug(countrySlug),
      getPublishedArticles({ countrySlug, limit: 12 }),
    ]);
    return { cities, country, articles };
  },
  ["country-data-hub"],
  { revalidate: 300, tags: ["cities", "countries", "articles"] }
);

export async function generateMetadata({ params }: { params: { countrySlug: string } }): Promise<Metadata> {
  const { cities, country } = await getCachedCountryData(params.countrySlug);
  if (!cities.length && !country) return {};
  const countryName = country?.name || (cities.length ? cities[0].country : params.countrySlug);

  const title =
    country?.metaTitle?.trim() ||
    `${countryName} Destinations — Attraction News & Travel Updates | ${SITE_NAME}`;
  const description =
    country?.metaDescription?.trim() ||
    (country?.intro
      ? country.intro.slice(0, 155)
      : `Explore attraction news and travel updates from ${countryName}'s cities: ${cities.map((c) => c.name).join(", ")}.`);

  return buildMetadata({
    title,
    description,
    path: countryPath(params.countrySlug),
  });
}

export default async function CountryPage({ params }: { params: { countrySlug: string } }) {
  const { cities, country, articles } = await getCachedCountryData(params.countrySlug);
  if (!cities.length && !country) {
    const maybeArticle = await getPublishedArticleByAnySlug(params.countrySlug);
    if (maybeArticle) {
      permanentRedirect(articlePath(maybeArticle.countrySlug, maybeArticle.citySlug, maybeArticle.slug));
    }
    const maybeCity = await getCityBySlug(params.countrySlug);
    if (maybeCity) {
      permanentRedirect(cityPath(maybeCity.countrySlug, maybeCity.slug));
    }
    notFound();
  }

  const countryName = country?.name || (cities.length ? cities[0].country : params.countrySlug);

  const breadcrumbs = [
    { name: "Home", path: "/" },
    { name: "Destinations", path: "/destinations" },
    { name: countryName, path: countryPath(params.countrySlug) },
  ];

  return (
    <>
      <CountryClient
        countrySlug={params.countrySlug}
        countryName={countryName}
        countryData={country}
        cities={cities}
        articles={articles}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript([
            breadcrumbJsonLd(breadcrumbs),
            itemListJsonLd(cities.map((c) => ({ name: c.name, path: cityPath(c.countrySlug, c.slug) }))),
          ]),
        }}
      />
    </>
  );
}
