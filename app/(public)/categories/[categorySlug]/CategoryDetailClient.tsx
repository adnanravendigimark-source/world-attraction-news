"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import Container from "@/components/Container";
import NumberedPagination from "@/components/NumberedPagination";
import NewsletterForm from "@/components/NewsletterForm";
import EmptyState from "@/components/EmptyState";
import type { Category } from "@/lib/categories";
import type { ArticleWithRelations, StoryCoverage } from "@/lib/articles";
import { publicPath } from "@/lib/content/paths";
import CategoryIcon from "@/components/CategoryIcon";

interface Filters {
  city: string;
  q: string;
  sort: "latest" | "oldest" | "popular";
}

function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function CategoryDetailClient({
  category,
  articles,
  total,
  page,
  totalPages,
  allCategories,
  coverage,
  currentFilters,
}: {
  category: Category;
  articles: ArticleWithRelations[];
  total: number;
  page: number;
  totalPages: number;
  allCategories: Category[];
  coverage: StoryCoverage;
  currentFilters: Filters;
}) {
  const router = useRouter();
  const [q, setQ] = useState(currentFilters.q);

  function navigate(next: Partial<Filters & { page: number }>) {
    const merged = {
      city: next.city !== undefined ? next.city : currentFilters.city,
      q: next.q !== undefined ? next.q : currentFilters.q,
      sort: next.sort !== undefined ? next.sort : currentFilters.sort,
      page: next.page ?? 1,
    };
    const params = new URLSearchParams();
    if (merged.city) params.set("city", merged.city);
    if (merged.q) params.set("q", merged.q);
    if (merged.sort !== "latest") params.set("sort", merged.sort);
    if (merged.page > 1) params.set("page", String(merged.page));
    const qs = params.toString();
    router.push(qs ? `/categories/${category.slug}?${qs}` : `/categories/${category.slug}`);
  }

  const hasActiveFilters = Boolean(currentFilters.city || currentFilters.q);
  const heroImage = category.image || coverage.latestImage;
  const allStories = coverage.news + coverage.guides;
  // Keep the city in the list when it is the active filter, even if it has
  // no stories (a hand-typed URL), so the pill shows what is selected.
  const cityPills = coverage.cities.some((c) => c.slug === currentFilters.city) || !currentFilters.city
    ? coverage.cities
    : [...coverage.cities, { slug: currentFilters.city, name: currentFilters.city.replace(/-/g, " "), count: 0 }];

  return (
    <div className="bg-white min-h-screen text-ink-900 pb-16">
      {/* =========================================
          1. BREADCRUMBS & HERO HEADER
      ========================================= */}
      <div className="border-b border-ink-100 bg-white pt-5 pb-8">
        <Container>
          <nav className="flex items-center gap-1.5 text-xs font-semibold text-ink-400 mb-4">
            <Link href="/" className="hover:text-ink-900 transition-colors">
              Home
            </Link>
            <span>&gt;</span>
            <Link href="/categories" className="hover:text-ink-900 transition-colors">
              Categories
            </Link>
            <span>&gt;</span>
            <span className="text-ink-800">{category.name}</span>
          </nav>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex flex-col sm:flex-row gap-5 items-start max-w-2xl">
              {heroImage && (
                <div className="relative h-28 w-44 sm:h-32 sm:w-48 shrink-0 overflow-hidden rounded-2xl border border-ink-200 shadow-xs">
                  <Image
                    src={heroImage}
                    alt={category.imageAlt || category.name}
                    fill
                    className="object-cover"
                    sizes="200px"
                    priority
                  />
                </div>
              )}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <CategoryIcon slug={category.slug} className="h-4 w-4 text-signal" />
                  <span className="text-[11px] font-black uppercase tracking-widest text-signal">
                    CATEGORY
                  </span>
                </div>
                <h1 className="font-serif text-3xl sm:text-4xl lg:text-[44px] font-black tracking-tight text-ink-900">
                  {category.name}
                </h1>
                <p className="mt-2 text-xs sm:text-sm text-ink-600 leading-relaxed font-medium">
                  {category.description || `Travel news and guides about ${category.name.toLowerCase()}.`}
                </p>
              </div>
            </div>

            <div className="relative rounded-xl border border-rose-100/80 bg-rose-50/40 p-4 sm:p-5 lg:w-[380px] overflow-hidden">
              <div className="absolute right-2 -bottom-4 opacity-15 pointer-events-none">
                <svg className="w-32 h-32 text-rose-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              </div>

              <h3 className="font-sans text-xs font-black uppercase tracking-wider text-ink-900">
                GET {category.name.toUpperCase()} ALERTS
              </h3>
              <p className="mt-1 text-[11px] text-ink-500 leading-normal">
                Get new {category.name.toLowerCase()} stories in your inbox.
              </p>
              <div className="mt-2.5">
                <NewsletterForm source={`category-${category.slug}`} variant="light" />
              </div>
            </div>
          </div>
        </Container>
      </div>

      {/* =========================================
          2. FILTER PILLS & SORT ROW
      ========================================= */}
      <div className="border-b border-ink-200 bg-ink-50/50 py-3">
        <Container>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* City pills: only cities that have stories in this category */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
              <button
                type="button"
                onClick={() => navigate({ city: "", page: 1 })}
                className={`whitespace-nowrap rounded-md px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-all ${
                  !currentFilters.city
                    ? "bg-signal text-white shadow-sm"
                    : "bg-white text-ink-700 hover:bg-ink-200 border border-ink-200/80"
                }`}
              >
                ALL STORIES
              </button>
              {cityPills.map((c) => (
                <button
                  key={c.slug}
                  type="button"
                  onClick={() => navigate({ city: c.slug, page: 1 })}
                  className={`whitespace-nowrap rounded-md px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-all ${
                    currentFilters.city === c.slug
                      ? "bg-signal text-white shadow-sm"
                      : "bg-white text-ink-700 hover:bg-ink-200 border border-ink-200/80"
                  }`}
                >
                  {c.name}
                  {c.count > 0 && <span className="ml-1 opacity-60">{c.count}</span>}
                </button>
              ))}
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              <span className="text-xs font-bold text-ink-500">Sort by:</span>
              <select
                value={currentFilters.sort}
                onChange={(e) => navigate({ sort: e.target.value as Filters["sort"], page: 1 })}
                className="rounded-md border border-ink-200 bg-white px-3 py-1 text-xs font-bold text-ink-800 focus:border-signal focus:outline-none cursor-pointer"
              >
                <option value="latest">Latest</option>
                <option value="popular">Most Popular</option>
                <option value="oldest">Oldest</option>
              </select>
            </div>
          </div>

          {/* Search */}
          <div className="mt-3 flex items-center gap-2">
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") navigate({ q, page: 1 });
              }}
              placeholder={`Search ${category.name.toLowerCase()} stories...`}
              className="w-full max-w-sm rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs text-ink-800 placeholder:text-ink-400 focus:border-signal focus:outline-none"
            />
            <button
              type="button"
              onClick={() => navigate({ q, page: 1 })}
              className="rounded-lg bg-ink-900 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white hover:bg-ink-900/90"
            >
              Search
            </button>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  setQ("");
                  router.push(`/categories/${category.slug}`);
                }}
                className="text-[11px] font-bold text-ink-500 hover:text-ink-800"
              >
                Clear filters
              </button>
            )}
          </div>
        </Container>
      </div>

      {/* =========================================
          3. STORY LIST & SIDEBAR
      ========================================= */}
      <section className="py-8 sm:py-10">
        <Container>
          <div className="grid gap-8 lg:grid-cols-12 items-start">
            {/* Left Column (68% / 8 cols): Horizontal Articles */}
            <div className="lg:col-span-8 flex flex-col gap-5">
              <div className="flex items-center justify-between border-b border-ink-200 pb-3">
                <span className="text-xs font-black uppercase tracking-widest text-signal">
                  {total} {total === 1 ? "STORY" : "STORIES"} IN {category.name.toUpperCase()}
                </span>
                <Link
                  href="/categories"
                  className="text-xs font-black uppercase tracking-wider text-signal hover:underline flex items-center gap-1"
                >
                  <span>View All Categories</span>
                  <span aria-hidden="true">→</span>
                </Link>
              </div>

              {articles.length === 0 ? (
                <EmptyState
                  title="No stories found"
                  description={hasActiveFilters ? "Try a different search or clear the filters." : `No published stories in ${category.name} yet — check back soon.`}
                  actionLabel={hasActiveFilters ? "View all stories" : undefined}
                  actionHref={hasActiveFilters ? `/categories/${category.slug}` : undefined}
                />
              ) : (
                articles.map((article) => {
                  const href = publicPath(article);
                  const place = article.cityName || article.countryName || (article.type === "news" ? "Travel News" : "Travel Guide");

                  return (
                    <article
                      key={article.id}
                      className="group flex flex-col sm:flex-row items-stretch gap-4 sm:gap-6 bg-white p-3.5 sm:p-4 rounded-2xl border border-ink-200/80 shadow-sm hover:shadow-md hover:border-ink-300 transition-all"
                    >
                      <Link
                        href={href}
                        className="relative w-full sm:w-56 md:w-64 shrink-0 h-44 sm:h-auto min-h-[140px] rounded-xl overflow-hidden bg-ink-100"
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
                          <div className="flex h-full w-full items-center justify-center bg-ink-100 text-xs font-semibold text-ink-400">
                            No image
                          </div>
                        )}
                      </Link>

                      <div className="flex flex-1 flex-col justify-between py-1">
                        <div>
                          <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider">
                            <span className="text-signal">{place}</span>
                            <span className="text-ink-300">•</span>
                            <span className="text-ink-500">{article.type === "news" ? "News" : "Guide"}</span>
                          </div>

                          <h2 className="mt-1.5 font-sans text-base sm:text-lg font-black leading-snug text-ink-900 group-hover:text-signal transition-colors">
                            <Link href={href}>{article.title}</Link>
                          </h2>

                          <p className="mt-2 text-xs sm:text-[13px] leading-relaxed text-ink-600 line-clamp-2">
                            {article.excerpt}
                          </p>
                        </div>

                        <div className="mt-3.5 pt-3 border-t border-ink-100 text-[11px] text-ink-500">
                          {article.authorName && (
                            <>
                              <span>By {article.authorName}</span>
                              <span className="mx-1.5">•</span>
                            </>
                          )}
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
                basePath={`/categories/${category.slug}`}
                searchParams={{
                  city: currentFilters.city || undefined,
                  q: currentFilters.q || undefined,
                  sort: currentFilters.sort !== "latest" ? currentFilters.sort : undefined,
                }}
              />
            </div>

            {/* Right Sidebar (32% / 4 cols) */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              {/* What this category holds, from the published stories */}
              <div className="rounded-2xl border border-ink-200 bg-white p-5 sm:p-6 shadow-sm">
                <h3 className="font-sans text-xs sm:text-sm font-black uppercase tracking-wider text-ink-900 mb-3 pb-2 border-b border-ink-100">
                  In {category.name}
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-3 bg-ink-50 rounded-xl text-center">
                    <p className="text-xl font-black text-signal">{allStories}</p>
                    <p className="text-[10px] text-ink-500 font-bold uppercase">Stories</p>
                  </div>
                  <Link href="/news" className="p-3 bg-ink-50 rounded-xl text-center hover:bg-ink-100 transition-colors">
                    <p className="text-xl font-black text-ink-900">{coverage.news}</p>
                    <p className="text-[10px] text-ink-500 font-bold uppercase">News</p>
                  </Link>
                  <Link href="/latest-news" className="p-3 bg-ink-50 rounded-xl text-center hover:bg-ink-100 transition-colors">
                    <p className="text-xl font-black text-ink-900">{coverage.guides}</p>
                    <p className="text-[10px] text-ink-500 font-bold uppercase">Guides</p>
                  </Link>
                </div>
                {coverage.cities.length > 0 && (
                  <p className="mt-3 text-xs text-ink-600 leading-relaxed">
                    Places covered: <strong className="text-ink-900">{coverage.cities.slice(0, 6).map((c) => c.name).join(", ")}{coverage.cities.length > 6 ? ` and ${coverage.cities.length - 6} more` : ""}</strong>
                  </p>
                )}
              </div>

              {/* Browse Other Categories */}
              {allCategories.length > 0 && (
                <div className="rounded-2xl border border-ink-200 bg-white p-5 sm:p-6 shadow-sm">
                  <h3 className="font-sans text-xs sm:text-sm font-black uppercase tracking-wider text-ink-900 mb-3 pb-2 border-b border-ink-100">
                    Other Categories
                  </h3>
                  <div className="flex flex-col gap-2">
                    {allCategories
                      .filter((c) => c.slug !== category.slug)
                      .slice(0, 5)
                      .map((cat) => (
                        <Link
                          key={cat.id}
                          href={`/categories/${cat.slug}`}
                          className="flex items-center justify-between py-1.5 text-xs text-ink-700 hover:text-signal font-bold group"
                        >
                          <span className="flex items-center gap-2">
                            <CategoryIcon slug={cat.slug} className="h-3.5 w-3.5 text-ink-400 group-hover:text-signal" />
                            {cat.name}
                          </span>
                          <span className="text-ink-400 group-hover:translate-x-0.5 transition-transform">→</span>
                        </Link>
                      ))}
                  </div>
                </div>
              )}

              {/* Have News in Category? Dark Box */}
              <div className="relative overflow-hidden rounded-2xl bg-ink-900 text-white p-6 shadow-md flex flex-col gap-3">
                <div className="absolute right-2 -bottom-2 opacity-15 pointer-events-none">
                  <svg className="w-24 h-24 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                </div>

                <h3 className="font-serif text-lg font-black text-white">
                  Cover {category.name}?
                </h3>
                <p className="text-xs text-ink-300 leading-relaxed max-w-[260px]">
                  Have news or a guide about {category.name.toLowerCase()}? Send it to our editors.
                </p>
                <Link
                  href="/write-for-us"
                  className="mt-2 inline-flex items-center justify-center gap-1.5 rounded-lg bg-signal py-2.5 px-4 text-xs font-black uppercase tracking-wider text-white hover:bg-signal-dark transition-colors shadow-sm self-start"
                >
                  <span>WRITE FOR US</span>
                  <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>
          </div>
        </Container>
      </section>

    </div>
  );
}
