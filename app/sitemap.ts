import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { getCities } from "@/lib/cities";
import { getCategories } from "@/lib/categories";
import { getPublishedArticles } from "@/lib/articles";
import { getAttractions } from "@/lib/attractions";
import { getPublishedAuthorSlugs } from "@/lib/users";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [cities, categories, articles, attractions, authorSlugs] = await Promise.all([
    getCities(),
    getCategories(),
    getPublishedArticles({ limit: 5000 }),
    getAttractions(),
    getPublishedAuthorSlugs(),
  ]);

  // /search is deliberately excluded — its content is entirely query-
  // dependent and every variant is noindex (see app/(public)/search/page.tsx).
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "hourly", priority: 1 },
    { url: `${SITE_URL}/latest-news`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${SITE_URL}/cities`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${SITE_URL}/categories`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${SITE_URL}/about`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE_URL}/write-for-us`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE_URL}/contact`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE_URL}/privacy-policy`, changeFrequency: "yearly", priority: 0.1 },
    { url: `${SITE_URL}/terms-and-conditions`, changeFrequency: "yearly", priority: 0.1 },
    { url: `${SITE_URL}/cookie-policy`, changeFrequency: "yearly", priority: 0.1 },
    { url: `${SITE_URL}/editorial-policy`, changeFrequency: "yearly", priority: 0.1 },
    { url: `${SITE_URL}/disclaimer`, changeFrequency: "yearly", priority: 0.1 },
  ];

  const cityPages: MetadataRoute.Sitemap = cities.flatMap((c) => [
    { url: `${SITE_URL}/cities/${c.slug}`, changeFrequency: "daily" as const, priority: 0.8 },
    { url: `${SITE_URL}/cities/${c.slug}/attractions`, changeFrequency: "weekly" as const, priority: 0.5 },
  ]);

  const categoryPages: MetadataRoute.Sitemap = categories.map((c) => ({
    url: `${SITE_URL}/categories/${c.slug}`,
    changeFrequency: "daily",
    priority: 0.7,
  }));

  const attractionPages: MetadataRoute.Sitemap = attractions.map((a) => ({
    url: `${SITE_URL}/cities/${a.citySlug}/attractions/${a.slug}`,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  const articlePages: MetadataRoute.Sitemap = articles.map((a) => ({
    url: `${SITE_URL}/cities/${a.citySlug}/${a.slug}`,
    lastModified: a.updatedAt ? new Date(a.updatedAt) : undefined,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const authorPages: MetadataRoute.Sitemap = authorSlugs.map((slug) => ({
    url: `${SITE_URL}/author/${slug}`,
    changeFrequency: "weekly",
    priority: 0.4,
  }));

  return [...staticPages, ...cityPages, ...categoryPages, ...attractionPages, ...articlePages, ...authorPages];
}
