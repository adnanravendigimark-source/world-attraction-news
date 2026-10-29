import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { unstable_cache } from "next/cache";
import CityDetailClient from "./CityDetailClient";
import { getCityBySlug } from "@/lib/cities";
import { publicPath } from "@/lib/content/paths";
import { getPublishedArticles, getPublishedArticleByAnySlug, getPublishedCountryGuide } from "@/lib/articles";
import GuideArticle from "../GuideArticle";
import { resolvePageMetadata, breadcrumbJsonLd, itemListJsonLd, jsonLdScript } from "@/lib/seo";
import { cityPath, countryPath, articlePath } from "@/lib/destinations";

// Pure read, no searchParams — real ISR. Admin city edits and article
// publish/unpublish for this city call revalidatePath(cityPath(countrySlug, citySlug)),
// i.e. revalidatePath(`/${countrySlug}/${citySlug}`).
export const revalidate = 3600;

const getCachedCityBySlug = unstable_cache(
  (slug: string) => getCityBySlug(slug),
  ["city-by-slug"],
  { revalidate: 3600, tags: ["cities"] }
);

const getCachedCityPageData = unstable_cache(
  async (citySlug: string) => {
    const articles = await getPublishedArticles({ citySlug, types: ["news", "guide"] });
    return { articles };
  },
  ["city-page-data-v2"],
  { revalidate: 3600, tags: ["articles"] }
);

// Empty list = nothing prebuilt at deploy; each page renders on first visit,
// then is served from cache until a publish/edit purges it (lib/revalidateSite.ts).
export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: { countrySlug: string; citySlug: string };
}): Promise<Metadata> {
  const city = await getCachedCityBySlug(params.citySlug);
  if (!city) {
    // A country-level guide at /[country]/[slug] (Track B1).
    const guide = await getPublishedCountryGuide(params.countrySlug, params.citySlug);
    if (guide) {
      return resolvePageMetadata(articlePath(guide.countrySlug, "", guide.slug), {
        title: guide.metaTitle || guide.title,
        description: guide.metaDescription || guide.excerpt,
        image: guide.image,
        canonicalOverride: guide.canonicalUrl || undefined,
      });
    }
  }
  if (!city || city.countrySlug !== params.countrySlug) return {};
  // resolvePageMetadata so an admin's noindex/nofollow override for this
  // city (Admin -> Indexing -> Destinations, key `city:<id>`) actually
  // reaches the live page — buildMetadata alone ignored it, same gap fixed
  // on the country page (see that file's comment) and now fixed here too
  // for consistency, since the Indexing admin UI already implied this
  // toggle worked for cities.
  return resolvePageMetadata(cityPath(city.countrySlug, city.slug), {
    title: city.metaTitle || `${city.name}, ${city.country}: Travel News & Guides`,
    description: city.metaDescription || city.intro || `Travel news and guides for ${city.name}, ${city.country}.`,
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
    // City slugs win; otherwise this may be a country-level guide.
    const guide = await getPublishedCountryGuide(params.countrySlug, params.citySlug);
    if (guide) return <GuideArticle article={guide} countView={false} />;
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
              articles.map((a) => ({ name: a.title, path: publicPath(a) }))
            ),
          ]),
        }}
      />
    </>
  );
}
