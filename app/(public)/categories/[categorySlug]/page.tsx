import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CategoryDetailClient from "./CategoryDetailClient";
import { getCategoryBySlug, getCategories, Category } from "@/lib/categories";
import { getPublishedArticles } from "@/lib/articles";
import { buildMetadata, breadcrumbJsonLd, itemListJsonLd } from "@/lib/seo";
import { SITE_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";

const FALLBACK_CATEGORIES: Record<string, Category> = {
  "new-attractions": {
    id: "new-attractions",
    slug: "new-attractions",
    name: "New Attractions",
    description: "First-look reporting, opening dates, and construction milestones for brand-new rides, lands, and themed experiences.",
    sortOrder: 1,
  },
  "theme-parks": {
    id: "theme-parks",
    slug: "theme-parks",
    name: "Theme Parks",
    description: "Comprehensive coverage of major theme park resorts including Walt Disney World, Universal, Disneyland Paris, and Tokyo Disney.",
    sortOrder: 2,
  },
  "water-parks": {
    id: "water-parks",
    slug: "water-parks",
    name: "Water Parks",
    description: "New water coasters, wave lagoon expansions, and splash park intelligence worldwide.",
    sortOrder: 3,
  },
  "zoos-and-aquariums": {
    id: "zoos-and-aquariums",
    slug: "zoos-and-aquariums",
    name: "Zoos & Aquariums",
    description: "Wildlife conservation habitats, oceanarium exhibits, and marine life attractions.",
    sortOrder: 4,
  },
  "museums-and-culture": {
    id: "museums-and-culture",
    slug: "museums-and-culture",
    name: "Museums & Culture",
    description: "World-class exhibitions, historic palace restorations, and immersive cultural institutions.",
    sortOrder: 5,
  },
  "iconic-landmarks": {
    id: "iconic-landmarks",
    slug: "iconic-landmarks",
    name: "Iconic Landmarks",
    description: "Observation decks, architectural monuments, and historic wonders across global cities.",
    sortOrder: 6,
  },
  "events-and-festivals": {
    id: "events-and-festivals",
    slug: "events-and-festivals",
    name: "Events & Festivals",
    description: "Seasonal parades, drone light shows, fireworks, and anniversary spectacles.",
    sortOrder: 7,
  },
  "tickets-and-pricing": {
    id: "tickets-and-pricing",
    slug: "tickets-and-pricing",
    name: "Tickets & Pricing",
    description: "Annual pass restructuring, queue reservation strategies, and pricing shifts.",
    sortOrder: 8,
  },
  "openings-and-closures": {
    id: "openings-and-closures",
    slug: "openings-and-closures",
    name: "Openings & Closures",
    description: "Seasonal maintenance schedules, ride refurbishments, and grand opening timelines.",
    sortOrder: 9,
  },
  "visitor-tips": {
    id: "visitor-tips",
    slug: "visitor-tips",
    name: "Visitor Tips",
    description: "Insider guides, transit hacks, best times to visit, and crowd management strategies.",
    sortOrder: 10,
  },
};

export async function generateMetadata({
  params,
}: {
  params: { categorySlug: string };
}): Promise<Metadata> {
  const category = (await getCategoryBySlug(params.categorySlug)) || FALLBACK_CATEGORIES[params.categorySlug];
  if (!category) return {};
  return buildMetadata({
    title: `${category.name} Attraction Coverage & News | ${SITE_NAME}`,
    description: category.description || `The latest ${category.name.toLowerCase()} news from attractions around the world.`,
    path: `/categories/${category.slug}`,
  });
}

export default async function CategoryPage({
  params,
}: {
  params: { categorySlug: string };
}) {
  const category = (await getCategoryBySlug(params.categorySlug)) || FALLBACK_CATEGORIES[params.categorySlug];
  if (!category) notFound();

  const [articles, allCategories] = await Promise.all([
    getPublishedArticles({ categorySlug: category.slug }),
    getCategories(),
  ]);

  const breadcrumbs = [
    { name: "Home", path: "/" },
    { name: "Categories", path: "/categories" },
    { name: category.name, path: `/categories/${category.slug}` },
  ];

  return (
    <>
      <CategoryDetailClient
        category={category}
        articles={articles}
        allCategories={allCategories.length > 0 ? allCategories : Object.values(FALLBACK_CATEGORIES)}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            breadcrumbJsonLd(breadcrumbs),
            itemListJsonLd(articles.map((a) => ({ name: a.title, path: `/latest-news/${a.slug}` }))),
          ]),
        }}
      />
    </>
  );
}
