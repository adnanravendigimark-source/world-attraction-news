import Link from "next/link";
import type { Metadata } from "next";
import Container from "@/components/Container";
import Breadcrumbs from "@/components/Breadcrumbs";
import ArticleCard from "@/components/ArticleCard";
import EmptyState from "@/components/EmptyState";
import Pagination from "@/components/Pagination";
import { getCities } from "@/lib/cities";
import { getCategories } from "@/lib/categories";
import { getPublishedArticlesPage } from "@/lib/articles";
import { buildMetadata, breadcrumbJsonLd } from "@/lib/seo";
import { SITE_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";

// Filtered/paginated variants (page 2+, or any city/category/search filter)
// are noindexed — the unfiltered page 1 is the canonical entry point for
// search engines, avoiding near-duplicate-content pages competing with each
// other for the same queries.
export async function generateMetadata({
  searchParams,
}: {
  searchParams: { city?: string; category?: string; q?: string; page?: string };
}): Promise<Metadata> {
  const isFiltered = Boolean(searchParams?.city || searchParams?.category || searchParams?.q || (searchParams?.page && searchParams.page !== "1"));
  return buildMetadata({
    title: `Latest News | ${SITE_NAME}`,
    description: "The newest published attraction news from cities around the world — filter by city, category, or search.",
    path: "/latest-news",
    noIndex: isFiltered,
  });
}

const breadcrumbs = [{ name: "Home", path: "/" }, { name: "Latest News", path: "/latest-news" }];

export default async function LatestNewsPage({
  searchParams,
}: {
  searchParams: { city?: string; category?: string; q?: string; page?: string };
}) {
  const page = Math.max(1, Number(searchParams?.page) || 1);
  const [cities, categories, result] = await Promise.all([
    getCities(),
    getCategories(),
    getPublishedArticlesPage({
      citySlug: searchParams?.city,
      categorySlug: searchParams?.category,
      query: searchParams?.q,
      page,
      pageSize: 12,
    }),
  ]);

  const { articles, total, totalPages } = result;
  const featured = page === 1 && !searchParams?.q ? articles[0] : undefined;
  const gridArticles = featured ? articles.slice(1) : articles;

  const activeFilters = { city: searchParams?.city, category: searchParams?.category, q: searchParams?.q };

  function filterHref(next: Partial<typeof activeFilters>) {
    const merged = { ...activeFilters, ...next };
    const params = new URLSearchParams();
    if (merged.city) params.set("city", merged.city);
    if (merged.category) params.set("category", merged.category);
    if (merged.q) params.set("q", merged.q);
    const qs = params.toString();
    return qs ? `/latest-news?${qs}` : "/latest-news";
  }

  return (
    <Container className="py-10 sm:py-14">
      <Breadcrumbs items={breadcrumbs} />
      <h1 className="mt-3 font-serif text-2xl font-bold text-ink-900 sm:text-3xl">Latest News</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-600">
        The newest published attraction news from cities around the world — {total} {total === 1 ? "story" : "stories"} and
        counting.
      </p>

      <form action="/latest-news" method="get" className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        {activeFilters.city && <input type="hidden" name="city" value={activeFilters.city} />}
        {activeFilters.category && <input type="hidden" name="category" value={activeFilters.category} />}
        <input
          type="search"
          name="q"
          defaultValue={activeFilters.q}
          placeholder="Search headlines…"
          className="w-full max-w-xs rounded-md border border-ink-200 px-3.5 py-2 text-sm focus:border-signal focus:outline-none"
        />
        <button type="submit" className="rounded-md bg-ink-900 px-4 py-2 text-xs font-semibold text-white hover:bg-ink-800">
          Search
        </button>
      </form>

      <div className="mt-4 flex flex-wrap gap-4">
        <div>
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-ink-400">City</p>
          <div className="flex flex-wrap gap-1.5">
            <Link
              href={filterHref({ city: undefined })}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${!activeFilters.city ? "border-signal bg-signal-light text-signal" : "border-ink-200 bg-white text-ink-600 hover:border-signal"}`}
            >
              All
            </Link>
            {cities.map((c) => (
              <Link
                key={c.id}
                href={filterHref({ city: c.slug })}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${activeFilters.city === c.slug ? "border-signal bg-signal-light text-signal" : "border-ink-200 bg-white text-ink-600 hover:border-signal"}`}
              >
                {c.name}
              </Link>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-ink-400">Category</p>
          <div className="flex flex-wrap gap-1.5">
            <Link
              href={filterHref({ category: undefined })}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${!activeFilters.category ? "border-signal bg-signal-light text-signal" : "border-ink-200 bg-white text-ink-600 hover:border-signal"}`}
            >
              All
            </Link>
            {categories.map((c) => (
              <Link
                key={c.id}
                href={filterHref({ category: c.slug })}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${activeFilters.category === c.slug ? "border-signal bg-signal-light text-signal" : "border-ink-200 bg-white text-ink-600 hover:border-signal"}`}
              >
                {c.name}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {articles.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No stories match these filters"
            description="Try a different city, category, or search term."
            actionLabel="Clear filters"
            actionHref="/latest-news"
          />
        </div>
      ) : (
        <>
          {featured && (
            <div className="mt-8">
              <ArticleCard article={featured} size="large" />
            </div>
          )}
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {gridArticles.map((a) => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} basePath="/latest-news" searchParams={activeFilters} />
        </>
      )}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(breadcrumbs)) }}
      />
    </Container>
  );
}
