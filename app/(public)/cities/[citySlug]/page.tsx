import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CityDetailClient from "./CityDetailClient";
import { getCityBySlug } from "@/lib/cities";
import { getAttractionsByCityId } from "@/lib/attractions";
import { getPublishedArticles } from "@/lib/articles";
import { buildMetadata, breadcrumbJsonLd, itemListJsonLd } from "@/lib/seo";
import { SITE_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { citySlug: string } }): Promise<Metadata> {
  const city = await getCityBySlug(params.citySlug);
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
  const city = await getCityBySlug(params.citySlug);
  if (!city) notFound();

  const [articles, cityAttractions] = await Promise.all([
    getPublishedArticles({ citySlug: city.slug }),
    getAttractionsByCityId(city.id),
  ]);

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
          __html: JSON.stringify([
            breadcrumbJsonLd(breadcrumbs),
            itemListJsonLd(cityAttractions.map((a) => ({ name: a.name, path: `/cities/${city.slug}/attractions/${a.slug}` }))),
          ]),
        }}
      />
    </>
  );
}
