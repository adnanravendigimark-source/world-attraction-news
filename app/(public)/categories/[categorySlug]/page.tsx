import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CategoryDetailClient from "./CategoryDetailClient";
import { getCategoryBySlug, getCategories } from "@/lib/categories";
import { getPublishedArticlesPage, type ArticleSort } from "@/lib/articles";
import { getCities } from "@/lib/cities";
import { buildMetadata, breadcrumbJsonLd, itemListJsonLd, jsonLdScript } from "@/lib/seo";
import { SITE_NAME } from "@/lib/site";

// Stays force-dynamic: real server-side city filter, search, sort, and
// pagination come from searchParams — same reasoning as /latest-news.
export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

interface CategorySearchParams {
  city?: string;
  q?: string;
  page?: string;
  sort?: string;
}

function toSort(value: string | undefined): ArticleSort {
  return value === "oldest" || value === "popular" ? value : "latest";
}

export async function generateMetadata({
  params,
}: {
  params: { categorySlug: string };
}): Promise<Metadata> {
  const category = await getCategoryBySlug(params.categorySlug);
  if (!category) return {};
  return buildMetadata({
    title: `${category.name} Attraction Coverage & News | ${SITE_NAME}`,
    description: category.description || `The latest ${category.name.toLowerCase()} news from attractions around the world.`,
    path: `/categories/${category.slug}`,
  });
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: { categorySlug: string };
  searchParams: CategorySearchParams;
}) {
  // A category page only ever exists for a real category configured in the
  // Admin Panel — no fabricated fallback category is ever shown in its
  // place.
  const category = await getCategoryBySlug(params.categorySlug);
  if (!category) notFound();

  const page = Math.max(1, Number(searchParams?.page) || 1);
  const sort = toSort(searchParams?.sort);

  const [result, allCategories, cities] = await Promise.all([
    getPublishedArticlesPage({
      categorySlug: category.slug,
      citySlug: searchParams?.city,
      query: searchParams?.q,
      page,
      pageSize: PAGE_SIZE,
      sort,
    }),
    getCategories(),
    getCities(),
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
        articles={result.articles}
        total={result.total}
        page={result.page}
        totalPages={result.totalPages}
        allCategories={allCategories}
        cities={cities.map((c) => ({ slug: c.slug, name: c.name }))}
        currentFilters={{ city: searchParams?.city || "", q: searchParams?.q || "", sort }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript([
            breadcrumbJsonLd(breadcrumbs),
            itemListJsonLd(result.articles.map((a) => ({ name: a.title, path: `/cities/${a.citySlug}/${a.slug}` }))),
          ]),
        }}
      />
    </>
  );
}
