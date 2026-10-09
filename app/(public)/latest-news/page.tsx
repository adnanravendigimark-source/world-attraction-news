import type { Metadata } from "next";
import LatestNewsClient from "./LatestNewsClient";
import { getPublishedArticlesPage, getTrendingArticles, type ArticleSort } from "@/lib/articles";
import { getCitiesWithArticleCounts } from "@/lib/cities";
import { getCategories } from "@/lib/categories";
import { buildMetadata, breadcrumbJsonLd, jsonLdScript } from "@/lib/seo";

// Stays force-dynamic: real server-side filtering, search, sort, and
// pagination all come from searchParams, so every combination is a
// genuinely different response — there's nothing static to cache here.
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
    searchParams?.city ||
      searchParams?.category ||
      searchParams?.q ||
      (searchParams?.page && searchParams.page !== "1") ||
      (searchParams?.sort && searchParams.sort !== "latest")
  );
  return buildMetadata({
    title: "Blog — Attraction Guides, Openings & Travel Stories", // the root layout appends the site name
    description: "Attraction guides, openings, ticket tips and travel stories from our writers around the world.",
    path: "/latest-news",
    noIndex: isFiltered,
  });
}

const breadcrumbs = [
  { name: "Home", path: "/" },
  { name: "Blog", path: "/latest-news" },
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
        dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbJsonLd(breadcrumbs)) }}
      />
    </>
  );
}
