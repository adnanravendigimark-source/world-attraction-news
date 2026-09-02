import type { Metadata } from "next";
import DestinationsClient, { DestinationCity } from "./DestinationsClient";
import { getCitiesWithArticleCounts } from "@/lib/cities";
import { buildMetadata, breadcrumbJsonLd, itemListJsonLd } from "@/lib/seo";
import { SITE_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";

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
  const cities = await getCitiesWithArticleCounts();

  const mappedCities: DestinationCity[] = cities.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    country: c.country,
    intro: c.intro,
    heroImage: c.heroImage,
    heroImageAlt: c.heroImageAlt || c.name,
    articleCount: c.articleCount,
    isPopular: c.slug === "barcelona" || c.slug === "orlando" || c.slug === "paris",
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
