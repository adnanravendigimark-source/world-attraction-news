import Link from "next/link";
import type { Metadata } from "next";
import Container from "@/components/Container";
import Breadcrumbs from "@/components/Breadcrumbs";
import ArticleCard from "@/components/ArticleCard";
import SearchForm from "@/components/SearchForm";
import EmptyState from "@/components/EmptyState";
import { search } from "@/lib/search";
import { getTrendingArticles } from "@/lib/articles";
import { buildMetadata } from "@/lib/seo";
import { SITE_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";

// Search-result pages are entirely dependent on a reader's query string —
// there's no fixed content here for a search engine to index, so this page
// (and every ?q= variant of it) is deliberately noindex, same treatment as
// any other on-site search results page.
export const metadata: Metadata = buildMetadata({
  title: `Search | ${SITE_NAME}`,
  description: "Search articles, cities, and categories.",
  path: "/search",
  noIndex: true,
});

const breadcrumbs = [{ name: "Home", path: "/" }, { name: "Search", path: "/search" }];

export default async function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = (searchParams?.q || "").trim();
  const results = q ? await search(q) : { articles: [], cities: [], categories: [] };
  const totalResults = results.articles.length + results.cities.length + results.categories.length;

  const suggestions = !q || totalResults === 0 ? await getTrendingArticles(4) : [];

  return (
    <Container className="py-10 sm:py-14">
      <Breadcrumbs items={breadcrumbs} />
      <h1 className="mt-3 font-serif text-2xl font-bold text-ink-900 sm:text-3xl">Search</h1>
      <div className="mt-5 max-w-lg">
        <SearchForm initialQuery={q} autoFocus />
      </div>

      {!q ? (
        <p className="mt-8 text-sm text-ink-500">Search across every published article, city, and category on the site.</p>
      ) : (
        <>
          <p className="mt-8 text-sm text-ink-600">
            {totalResults === 0 ? (
              <>No results for <span className="font-semibold text-ink-900">"{q}"</span>.</>
            ) : (
              <>
                {totalResults} {totalResults === 1 ? "result" : "results"} for{" "}
                <span className="font-semibold text-ink-900">"{q}"</span>
              </>
            )}
          </p>

          {results.cities.length > 0 && (
            <div className="mt-8">
              <p className="text-[11px] font-bold uppercase tracking-wide text-ink-500">Cities</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {results.cities.map((c) => (
                  <Link key={c.id} href={`/cities/${c.slug}`} className="rounded-full border border-ink-200 px-3.5 py-1.5 text-xs font-semibold text-ink-700 hover:border-signal hover:text-signal">
                    {c.name} <span className="text-ink-400">· {c.country}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {results.categories.length > 0 && (
            <div className="mt-6">
              <p className="text-[11px] font-bold uppercase tracking-wide text-ink-500">Categories</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {results.categories.map((c) => (
                  <Link key={c.id} href={`/categories/${c.slug}`} className="rounded-full border border-ink-200 px-3.5 py-1.5 text-xs font-semibold text-ink-700 hover:border-signal hover:text-signal">
                    {c.name}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {results.articles.length > 0 && (
            <div className="mt-8">
              <p className="text-[11px] font-bold uppercase tracking-wide text-ink-500">Articles</p>
              <div className="mt-3 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {results.articles.map((a) => (
                  <ArticleCard key={a.id} article={a} />
                ))}
              </div>
            </div>
          )}

          {totalResults === 0 && (
            <div className="mt-6">
              <EmptyState
                title="Try a different search"
                description="Check your spelling, use a broader term, or browse by city or category instead."
                actionLabel="Browse latest news"
                actionHref="/latest-news"
              />
            </div>
          )}
        </>
      )}

      {suggestions.length > 0 && (
        <div className="mt-14 border-t border-ink-200 pt-8">
          <p className="text-[11px] font-bold uppercase tracking-wide text-ink-500">
            {q ? "You might also like" : "Trending now"}
          </p>
          <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {suggestions.map((a) => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </div>
        </div>
      )}
    </Container>
  );
}
