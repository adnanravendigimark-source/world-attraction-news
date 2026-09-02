import type { Metadata } from "next";
import LatestNewsClient from "./LatestNewsClient";
import { getPublishedArticlesPage, getTrendingArticles, type ArticleSort } from "@/lib/articles";
import { getCitiesWithArticleCounts } from "@/lib/cities";
import { getCategories } from "@/lib/categories";
import { buildMetadata, breadcrumbJsonLd } from "@/lib/seo";
import { SITE_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

interface LatestNewsSearchParams {
  city?: string;
  category?: string;
  q?: string;
  page?: string;
  sort?: string;
}

function toSort(value: string | undefined): ArticleSort {
  return value === "oldest" || value === "popular" ? value : "latest";
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: LatestNewsSearchParams;
}): Promise<Metadata> {
  const isFiltered = Boolean(
    searchParams?.city || searchParams?.category || searchParams?.q || (searchParams?.page && searchParams.page !== "1")
  );
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
  searchParams: LatestNewsSearchParams;
}) {
  const page = Math.max(1, Number(searchParams?.page) || 1);
  const sort = toSort(searchParams?.sort);

  const [result, trending, cities, categories] = await Promise.all([
    getPublishedArticlesPage({
      citySlug: searchParams?.city,
      categorySlug: searchParams?.category,
      query: searchParams?.q,
      page,
      pageSize: PAGE_SIZE,
      sort,
    }),
    getTrendingArticles(5),
    getCitiesWithArticleCounts(),
    getCategories(),
  ]);

  return (
    <>
      <LatestNewsClient
        articles={result.articles}
        total={result.total}
        page={result.page}
        totalPages={result.totalPages}
        trending={trending}
        cities={cities.map((c) => ({ slug: c.slug, name: c.name }))}
        categories={categories.map((c) => ({ slug: c.slug, name: c.name }))}
        currentFilters={{
          city: searchParams?.city || "",
          category: searchParams?.category || "",
          q: searchParams?.q || "",
          sort,
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(breadcrumbs)) }}
      />
    </>
  );
}
