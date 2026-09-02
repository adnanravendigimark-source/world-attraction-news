"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import Container from "@/components/Container";
import NumberedPagination from "@/components/NumberedPagination";
import NewsletterForm from "@/components/NewsletterForm";
import type { ArticleWithRelations } from "@/lib/articles";

interface Filters {
  city: string;
  category: string;
  q: string;
  sort: "latest" | "oldest" | "popular";
}

function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function LatestNewsClient({
  articles,
  total,
  page,
  totalPages,
  trending,
  cities,
  categories,
  currentFilters,
}: {
  articles: ArticleWithRelations[];
  total: number;
  page: number;
  totalPages: number;
  trending: ArticleWithRelations[];
  cities: { slug: string; name: string }[];
  categories: { slug: string; name: string }[];
  currentFilters: Filters;
}) {
  const router = useRouter();

  // Local, uncommitted form state — only pushed to the URL (and therefore
  // only actually re-queries the database) on "Apply Filters" or on
  // pressing Enter in the search field, so typing doesn't refetch on every
  // keystroke. Sort still applies immediately since it's a single select.
  const [q, setQ] = useState(currentFilters.q);
  const [city, setCity] = useState(currentFilters.city);
  const [category, setCategory] = useState(currentFilters.category);

  function navigate(next: Partial<Filters & { page: number }>) {
    const merged = {
      city: next.city !== undefined ? next.city : currentFilters.city,
      category: next.category !== undefined ? next.category : currentFilters.category,
      q: next.q !== undefined ? next.q : currentFilters.q,
      sort: next.sort !== undefined ? next.sort : currentFilters.sort,
      page: next.page ?? 1,
    };
    const params = new URLSearchParams();
    if (merged.city) params.set("city", merged.city);
    if (merged.category) params.set("category", merged.category);
    if (merged.q) params.set("q", merged.q);
    if (merged.sort !== "latest") params.set("sort", merged.sort);
    if (merged.page > 1) params.set("page", String(merged.page));
    const qs = params.toString();
    router.push(qs ? `/latest-news?${qs}` : "/latest-news");
  }

  function applyFilters() {
    navigate({ city, category, q, page: 1 });
  }

  function resetFilters() {
    setQ("");
    setCity("");
    setCategory("");
    router.push("/latest-news");
  }

  const hasActiveFilters = Boolean(currentFilters.city || currentFilters.category || currentFilters.q);

  return (
    <div className="bg-white min-h-screen text-[#0B1527] pb-16">
      {/* =========================================
          1. BREADCRUMBS & HERO WIRE HEADER
      ========================================= */}
      <div className="border-b border-slate-100 bg-white pt-5 pb-8">
        <Container>
          <nav className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 mb-4">
            <Link href="/" className="hover:text-slate-900 transition-colors">
              Home
            </Link>
            <span>&gt;</span>
            <span className="text-slate-800">Latest News</span>
          </nav>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="max-w-xl">
              <div className="flex items-center gap-2 mb-2">
                <span className="h-2 w-2 rounded-full bg-[#DC2626] animate-pulse" />
                <span className="text-[11px] font-black uppercase tracking-widest text-[#DC2626]">
                  CONTINUOUS WIRE
                </span>
              </div>
              <h1 className="font-serif text-3xl sm:text-4xl lg:text-[44px] font-black tracking-tight text-[#0B1527]">
                Latest News
              </h1>
              <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
                Stay updated with real-time attraction news, openings, ticket updates, and travel stories from around the world.
              </p>
            </div>

            <div className="relative rounded-xl border border-rose-100/80 bg-rose-50/40 p-4 sm:p-5 lg:w-[380px] overflow-hidden">
              <div className="absolute right-2 -bottom-4 opacity-15 pointer-events-none">
                <svg className="w-32 h-32 text-rose-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              </div>

              <h3 className="font-sans text-xs font-black uppercase tracking-wider text-[#0B1527]">
                Get the Latest Updates
              </h3>
              <p className="mt-1 text-[11px] text-slate-500 leading-normal">
                Subscribe to get attraction news and opening dates delivered to your inbox.
              </p>
              <div className="mt-2.5">
                <NewsletterForm source="latest-news" variant="light" />
              </div>
            </div>
          </div>
        </Container>
      </div>

      {/* =========================================
          2. SORT TOOLBAR
      ========================================= */}
      <div className="py-5 border-b border-slate-100 bg-white">
        <Container>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-xs font-semibold text-slate-500">
              {total} {total === 1 ? "story" : "stories"}
              {hasActiveFilters ? " matching your filters" : ""}
            </p>

            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <span>Sort by:</span>
              <select
                value={currentFilters.sort}
                onChange={(e) => navigate({ sort: e.target.value as Filters["sort"], page: 1 })}
                className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-800 focus:border-[#DC2626] focus:outline-none cursor-pointer"
              >
                <option value="latest">Latest</option>
                <option value="oldest">Oldest</option>
                <option value="popular">Most Popular</option>
              </select>
            </div>
          </div>
        </Container>
      </div>

      {/* =========================================
          3. TWO-COLUMN MAIN WIRE & SIDEBAR
      ========================================= */}
      <section className="py-8">
        <Container>
          <div className="grid gap-8 lg:grid-cols-12 items-start">
            {/* Left Column (68%): Horizontal News Cards */}
            <div className="lg:col-span-8 flex flex-col gap-5">
              {articles.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200">
                  <p className="font-bold text-slate-700">No stories match your filter criteria.</p>
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="mt-3 text-xs font-bold text-[#DC2626] hover:underline"
                    >
                      Reset all filters
                    </button>
                  )}
                </div>
              ) : (
                articles.map((article) => {
                  const href = `/cities/${article.citySlug}/${article.slug}`;

                  return (
                    <article
                      key={article.id}
                      className="group flex flex-col sm:flex-row items-stretch gap-4 sm:gap-6 bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md hover:border-slate-300 transition-all"
                    >
                      <Link
                        href={href}
                        className="relative w-full sm:w-56 md:w-64 shrink-0 h-44 sm:h-auto min-h-[140px] rounded-xl overflow-hidden bg-slate-100"
                      >
                        {article.image ? (
                          <Image
                            src={article.image}
                            alt={article.imageAlt || article.title}
                            fill
                            sizes="(min-width: 640px) 256px, 100vw"
                            className="object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-slate-100 text-xs font-semibold text-slate-400">
                            No image
                          </div>
                        )}
                      </Link>

                      <div className="flex flex-1 flex-col justify-between py-1">
                        <div>
                          <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider">
                            <span className="text-[#DC2626]">{article.cityName}</span>
                            {article.categoryName && (
                              <>
                                <span className="text-slate-300">•</span>
                                <span className="text-slate-500">{article.categoryName}</span>
                              </>
                            )}
                          </div>

                          <h2 className="mt-1.5 font-sans text-base sm:text-lg font-black leading-snug text-[#0B1527] group-hover:text-[#DC2626] transition-colors">
                            <Link href={href}>{article.title}</Link>
                          </h2>

                          <p className="mt-2 text-xs sm:text-[13px] leading-relaxed text-slate-600 line-clamp-2">
                            {article.excerpt}
                          </p>
                        </div>

                        <div className="mt-3.5 pt-3 border-t border-slate-100 text-[11px] text-slate-500">
                          <span>By {article.authorName}</span>
                          <span className="mx-1.5">•</span>
                          <span>{formatDate(article.publishedAt)}</span>
                          <span className="mx-1.5">•</span>
                          <span>{article.readingTimeMinutes || 1} min read</span>
                        </div>
                      </div>
                    </article>
                  );
                })
              )}

              <NumberedPagination
                page={page}
                totalPages={totalPages}
                basePath="/latest-news"
                searchParams={{
                  city: currentFilters.city || undefined,
                  category: currentFilters.category || undefined,
                  q: currentFilters.q || undefined,
                  sort: currentFilters.sort !== "latest" ? currentFilters.sort : undefined,
                }}
              />
            </div>

            {/* Right Column (32%): Refine Search & Trending Now */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
                <h3 className="font-sans text-xs sm:text-sm font-black uppercase tracking-wider text-[#0B1527] mb-4">
                  Refine Your Search
                </h3>

                <div className="mb-4">
                  <label htmlFor="search-news-input" className="block text-xs font-bold text-slate-700 mb-1.5">
                    Search News
                  </label>
                  <div className="relative">
                    <input
                      id="search-news-input"
                      type="text"
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") applyFilters();
                      }}
                      placeholder="Search by keyword..."
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 pr-8 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#DC2626] focus:bg-white focus:outline-none"
                    />
                    <svg
                      className="absolute right-3 top-2.5 h-3.5 w-3.5 text-slate-400"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <circle cx="11" cy="11" r="7" />
                      <path strokeLinecap="round" d="m21 21-4.3-4.3" />
                    </svg>
                  </div>
                </div>

                <div className="mb-4">
                  <label htmlFor="dest-dropdown" className="block text-xs font-bold text-slate-700 mb-1.5">
                    Destination
                  </label>
                  <select
                    id="dest-dropdown"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:border-[#DC2626] focus:bg-white focus:outline-none"
                  >
                    <option value="">All Destinations</option>
                    {cities.map((c) => (
                      <option key={c.slug} value={c.slug}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-5">
                  <label htmlFor="category-dropdown" className="block text-xs font-bold text-slate-700 mb-1.5">
                    Category
                  </label>
                  <select
                    id="category-dropdown"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:border-[#DC2626] focus:bg-white focus:outline-none"
                  >
                    <option value="">All Categories</option>
                    {categories.map((c) => (
                      <option key={c.slug} value={c.slug}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={applyFilters}
                    className="w-full rounded-lg bg-[#DC2626] py-2.5 text-xs font-black uppercase tracking-wider text-white shadow hover:bg-[#B91C1C] transition-colors"
                  >
                    APPLY FILTERS
                  </button>
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="text-center text-[11px] font-bold text-slate-500 hover:text-slate-800 py-1"
                    >
                      RESET
                    </button>
                  )}
                </div>
              </div>

              {/* Trending Now — real published articles ranked by real
                  view count / score, exactly like the homepage's Trending
                  Now section. Never a hardcoded list. */}
              {trending.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-[#DC2626] text-sm">📈</span>
                    <h3 className="font-sans text-xs sm:text-sm font-black uppercase tracking-wider text-[#0B1527]">
                      Trending Now
                    </h3>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {trending.map((item, i) => (
                      <Link
                        key={item.id}
                        href={`/cities/${item.citySlug}/${item.slug}`}
                        className="group flex items-center gap-3 py-3 hover:bg-slate-50/70 -mx-2 px-2 rounded-lg transition-colors"
                      >
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0B1527] text-[10px] font-black text-white">
                          {i + 1}
                        </span>

                        <div className="relative h-11 w-14 shrink-0 rounded-md overflow-hidden bg-slate-100">
                          {item.image && (
                            <Image src={item.image} alt={item.imageAlt || item.title} fill sizes="56px" className="object-cover group-hover:scale-105 transition-transform" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-bold text-[#0B1527] leading-snug line-clamp-2 group-hover:text-[#DC2626] transition-colors">
                            {item.title}
                          </h4>
                          <p className="mt-0.5 text-[10px] font-semibold text-slate-400 uppercase">
                            <span className="text-[#DC2626]">{item.cityName}</span> • {formatDate(item.publishedAt)}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}
