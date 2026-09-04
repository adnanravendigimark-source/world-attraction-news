import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { unstable_cache } from "next/cache";
import CityDetailClient from "./CityDetailClient";
import { getCityBySlug } from "@/lib/cities";
import { getAttractionsByCityId } from "@/lib/attractions";
import { getPublishedArticles } from "@/lib/articles";
import { buildMetadata, breadcrumbJsonLd, itemListJsonLd, jsonLdScript } from "@/lib/seo";
import { SITE_NAME } from "@/lib/site";

// Pure read, no searchParams — real ISR. Admin city edits and article
// publish/unpublish for this city call revalidatePath(`/cities/${slug}`).
//
// See app/(public)/page.tsx for why the DB reads below must go through
// unstable_cache (not just this `revalidate` export) to actually be cached:
// lib/db.ts's sql() calls are all no-store fetches, which otherwise force
// the whole route dynamic regardless of `revalidate`.
export const revalidate = 60;

const getCachedCityBySlug = unstable_cache(
  (slug: string) => getCityBySlug(slug),
  ["city-by-slug"],
  { revalidate: 60, tags: ["cities"] }
);

const getCachedCityPageData = unstable_cache(
  async (citySlug: string, cityId: string) => {
    const [articles, cityAttractions] = await Promise.all([
      getPublishedArticles({ citySlug }),
      getAttractionsByCityId(cityId),
    ]);
    return { articles, cityAttractions };
  },
  ["city-page-data"],
  { revalidate: 60, tags: ["articles", "attractions"] }
);

export async function generateMetadata({ params }: { params: { citySlug: string } }): Promise<Metadata> {
  const city = await getCachedCityBySlug(params.citySlug);
  if (!city) return {};
  return buildMetadata({
    title: city.metaTitle || `${city.name} Attraction News & Travel Intelligence | ${SITE_NAME}`,
    description: city.metaDescription || city.intro,
    path: `/cities/${city.slug}`,
    image: city.heroImage,
  });
}

export default async function CityPage({
  params,
}: {
  params: { citySlug: string };
}) {
  const city = await getCachedCityBySlug(params.citySlug);
  if (!city) notFound();

  const { articles, cityAttractions } = await getCachedCityPageData(city.slug, city.id);

  const breadcrumbs = [
    { name: "Home", path: "/" },
    { name: "Destinations", path: "/cities" },
    { name: city.name, path: `/cities/${city.slug}` },
  ];

  return (
    <>
      <CityDetailClient
        city={city}
        articles={articles}
        attractions={cityAttractions}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript([
            breadcrumbJsonLd(breadcrumbs),
            itemListJsonLd(cityAttractions.map((a) => ({ name: a.name, path: `/cities/${city.slug}/attractions/${a.slug}` }))),
          ]),
        }}
      />
    </>
  );
}
