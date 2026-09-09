import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { unstable_cache } from "next/cache";
import CityDetailClient from "./CityDetailClient";
import { getCityBySlug } from "@/lib/cities";
import { getPublishedArticles, getPublishedArticleByAnySlug } from "@/lib/articles";
import { buildMetadata, breadcrumbJsonLd, itemListJsonLd, jsonLdScript } from "@/lib/seo";
import { cityPath, countryPath, articlePath } from "@/lib/destinations";
import { SITE_NAME } from "@/lib/site";

// Pure read, no searchParams — real ISR. Admin city edits and article
// publish/unpublish for this city call revalidatePath(cityPath(countrySlug, citySlug)),
// i.e. revalidatePath(`/${countrySlug}/${citySlug}`).
export const revalidate = 60;

const getCachedCityBySlug = unstable_cache(
  (slug: string) => getCityBySlug(slug),
  ["city-by-slug"],
  { revalidate: 60, tags: ["cities"] }
);

const getCachedCityPageData = unstable_cache(
  async (citySlug: string) => {
    const articles = await getPublishedArticles({ citySlug });
    return { articles };
  },
  ["city-page-data"],
  { revalidate: 60, tags: ["articles"] }
);

export async function generateMetadata({
  params,
}: {
  params: { countrySlug: string; citySlug: string };
}): Promise<Metadata> {
  const city = await getCachedCityBySlug(params.citySlug);
  if (!city || city.countrySlug !== params.countrySlug) return {};
  return buildMetadata({
    title: city.metaTitle || `${city.name} Attraction News & Travel Intelligence | ${SITE_NAME}`,
    description: city.metaDescription || city.intro,
    path: cityPath(city.countrySlug, city.slug),
    image: city.heroImage,
  });
}

export default async function CityPage({
  params,
}: {
  params: { countrySlug: string; citySlug: string };
}) {
  const city = await getCachedCityBySlug(params.citySlug);
  if (!city) {
    const maybeArticle = await getPublishedArticleByAnySlug(params.citySlug);
    if (maybeArticle) {
      permanentRedirect(articlePath(maybeArticle.countrySlug, maybeArticle.citySlug, maybeArticle.slug));
    }
    notFound();
  }

  if (city.countrySlug !== params.countrySlug) {
    permanentRedirect(cityPath(city.countrySlug, city.slug));
  }

  const { articles } = await getCachedCityPageData(city.slug);

  const breadcrumbs = [
    { name: "Home", path: "/" },
    { name: "Destinations", path: "/destinations" },
    { name: city.country, path: countryPath(city.countrySlug) },
    { name: city.name, path: cityPath(city.countrySlug, city.slug) },
  ];

  return (
    <>
      <CityDetailClient
        city={city}
        articles={articles}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript([
            breadcrumbJsonLd(breadcrumbs),
            itemListJsonLd(
              articles.map((a) => ({ name: a.title, path: articlePath(city.countrySlug, city.slug, a.slug) }))
            ),
          ]),
        }}
      />
    </>
  );
}
