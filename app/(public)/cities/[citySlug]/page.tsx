import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CityDetailClient from "./CityDetailClient";
import { getCityBySlug, City } from "@/lib/cities";
import { getAttractionsByCityId } from "@/lib/attractions";
import { getCategories } from "@/lib/categories";
import { getPublishedArticles } from "@/lib/articles";
import { buildMetadata, breadcrumbJsonLd, itemListJsonLd } from "@/lib/seo";
import { SITE_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";

const FALLBACK_CITIES: Record<string, City> = {
  amsterdam: {
    id: "amsterdam",
    slug: "amsterdam",
    name: "Amsterdam",
    country: "Netherlands",
    intro:
      "News and visitor updates from Amsterdam's museums and canal-side attractions — the Anne Frank House, Van Gogh Museum, and historic waterways.",
    heroImage: "https://images.unsplash.com/photo-1534351590666-13e3e96b5017?auto=format&fit=crop&w=1200&q=80",
    heroImageAlt: "Amsterdam Canals and Historic Bridges",
    metaTitle: "Amsterdam Attraction News & Visitor Guides",
    metaDescription: "Latest news, ticket tips, and museum expansions in Amsterdam.",
    sortOrder: 2,
  },
  barcelona: {
    id: "barcelona",
    slug: "barcelona",
    name: "Barcelona",
    country: "Spain",
    intro:
      "News and visitor updates from Barcelona's landmark attractions, museums, and parks — from Gaudi's Sagrada Familia to Park Güell.",
    heroImage: "https://images.unsplash.com/photo-1583422409516-2895a77efded?auto=format&fit=crop&w=1200&q=80",
    heroImageAlt: "Barcelona Sagrada Familia and Cityscape",
    metaTitle: "Barcelona Attraction News & Visitor Guides",
    metaDescription: "Latest news, ticket tips, and landmark developments in Barcelona.",
    sortOrder: 1,
  },
  rome: {
    id: "rome",
    slug: "rome",
    name: "Rome",
    country: "Italy",
    intro:
      "News and visitor updates from Rome's ancient sites and museums — the Colosseum, the Roman Forum, Vatican City, and historic monuments.",
    heroImage: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=1200&q=80",
    heroImageAlt: "Rome Colosseum at Golden Hour",
    metaTitle: "Rome Attraction News & Visitor Guides",
    metaDescription: "Latest news, ticket tips, and archaeological site reporting in Rome.",
    sortOrder: 4,
  },
};

export async function generateMetadata({ params }: { params: { citySlug: string } }): Promise<Metadata> {
  const city = (await getCityBySlug(params.citySlug)) || FALLBACK_CITIES[params.citySlug];
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
  const city = (await getCityBySlug(params.citySlug)) || FALLBACK_CITIES[params.citySlug];
  if (!city) notFound();

  const [articles, categories, cityAttractions] = await Promise.all([
    getPublishedArticles({ citySlug: city.slug }),
    getCategories(),
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
        categories={categories}
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
