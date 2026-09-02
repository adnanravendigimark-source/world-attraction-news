import type { Metadata } from "next";
import LatestNewsClient, { ArticleItem } from "./LatestNewsClient";
import { getPublishedArticlesPage } from "@/lib/articles";
import { buildMetadata, breadcrumbJsonLd } from "@/lib/seo";
import { SITE_NAME } from "@/lib/site";

function formatDate(iso: string | null | undefined) {
  if (!iso) return "May 14, 2025";
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return "May 14, 2025";
  }
}

export const dynamic = "force-dynamic";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: { city?: string; category?: string; q?: string; page?: string };
}): Promise<Metadata> {
  const isFiltered = Boolean(searchParams?.city || searchParams?.category || searchParams?.q || (searchParams?.page && searchParams.page !== "1"));
  return buildMetadata({
    title: `Latest News — Real-Time Attraction News & Openings | ${SITE_NAME}`,
    description: "Stay updated with real-time attraction news, openings, ticket updates, and travel stories from around the world.",
    path: "/latest-news",
    noIndex: isFiltered,
  });
}

const breadcrumbs = [
  { name: "Home", path: "/" },
  { name: "Latest News", path: "/latest-news" },
];

export default async function LatestNewsPage({
  searchParams,
}: {
  searchParams: { city?: string; category?: string; q?: string; page?: string };
}) {
  const page = Math.max(1, Number(searchParams?.page) || 1);
  const result = await getPublishedArticlesPage({
    citySlug: searchParams?.city,
    categorySlug: searchParams?.category,
    query: searchParams?.q,
    page,
    pageSize: 10,
  });

  const { articles, total } = result;

  const mappedArticles: ArticleItem[] = articles.map((a) => ({
    id: a.id,
    slug: a.slug,
    citySlug: a.citySlug,
    cityName: a.cityName?.toUpperCase() || "THEME PARKS",
    categoryName: a.categoryName?.toUpperCase() || "LATEST WIRE",
    title: a.title,
    excerpt: a.excerpt,
    authorName: a.authorName || "Attraction News Team",
    publishedAt: formatDate(a.publishedAt),
    readingTimeMinutes: a.readingTimeMinutes || 3,
    image: a.image || undefined,
    imageAlt: a.imageAlt || a.title,
  }));

  return (
    <>
      <LatestNewsClient initialArticles={mappedArticles} totalCount={total} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(breadcrumbs)) }}
      />
    </>
  );
}
