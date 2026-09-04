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
import type { ArticleWithRelations } from "@/lib/articles";
import { articlePath } from "@/lib/destinations";

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
  cities,
  currentFilters,
}: {
  category: Category;
  articles: ArticleWithRelations[];
  total: number;
  page: number;
  totalPages: number;
  allCategories: Category[];
  cities: { slug: string; name: string }[];
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

  return (
    <div className="bg-white min-h-screen text-[#0B1527] pb-16">
      {/* =========================================
          1. BREADCRUMBS & HERO HEADER
      ========================================= */}
      <div className="border-b border-slate-100 bg-white pt-5 pb-8">
        <Container>
          <nav className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 mb-4">
            <Link href="/" className="hover:text-slate-900 transition-colors">
              Home
            </Link>
            <span>&gt;</span>
            <Link href="/categories" className="hover:text-slate-900 transition-colors">
              Categories
            </Link>
            <span>&gt;</span>
            <span className="text-slate-800">{category.name}</span>
          </nav>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="max-w-xl">
              <div className="flex items-center gap-2 mb-2">
                <span className="h-2 w-2 rounded-full bg-[#DC2626] animate-pulse" />
                <span className="text-[11px] font-black uppercase tracking-widest text-[#DC2626]">
                  EDITORIAL BEAT
                </span>
              </div>
              <h1 className="font-serif text-3xl sm:text-4xl lg:text-[44px] font-black tracking-tight text-[#0B1527]">
                {category.name}
              </h1>
              <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
                {category.description || `Targeted reporting, opening calendars, and attraction developments across ${category.name.toLowerCase()}.`}
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
                GET {category.name.toUpperCase()} ALERTS
              </h3>
              <p className="mt-1 text-[11px] text-slate-500 leading-normal">
                Stay updated on new attractions, ride tech, and venue openings worldwide.
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
      <div className="border-b border-slate-200 bg-slate-50/50 py-3">
        <Container>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* City Pills — real cities, not a hardcoded list */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
              <button
                type="button"
                onClick={() => navigate({ city: "", page: 1 })}
                className={`whitespace-nowrap rounded-md px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-all ${
                  !currentFilters.city
                    ? "bg-[#DC2626] text-white shadow-sm"
                    : "bg-white text-slate-700 hover:bg-slate-200 border border-slate-200/80"
                }`}
              >
                ALL STORIES
              </button>
              {cities.map((c) => (
                <button
                  key={c.slug}
                  type="button"
                  onClick={() => navigate({ city: c.slug, page: 1 })}
                  className={`whitespace-nowrap rounded-md px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-all ${
                    currentFilters.city === c.slug
                      ? "bg-[#DC2626] text-white shadow-sm"
                      : "bg-white text-slate-700 hover:bg-slate-200 border border-slate-200/80"
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              <span className="text-xs font-bold text-slate-500">Sort by:</span>
              <select
                value={currentFilters.sort}
                onChange={(e) => navigate({ sort: e.target.value as Filters["sort"], page: 1 })}
                className="rounded-md border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-800 focus:border-[#DC2626] focus:outline-none cursor-pointer"
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
              className="w-full max-w-sm rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#DC2626] focus:outline-none"
            />
            <button
              type="button"
              onClick={() => navigate({ q, page: 1 })}
              className="rounded-lg bg-[#0B1527] px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white hover:bg-[#0B1527]/90"
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
                className="text-[11px] font-bold text-slate-500 hover:text-slate-800"
              >
                Clear filters
              </button>
            )}
          </div>
        </Container>
      </div>

      {/* =========================================
          3. TWO-COLUMN WIRE & SIDEBAR
      ========================================= */}
      <section className="py-8 sm:py-10">
        <Container>
          <div className="grid gap-8 lg:grid-cols-12 items-start">
            {/* Left Column (68% / 8 cols): Horizontal Articles */}
            <div className="lg:col-span-8 flex flex-col gap-5">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <span className="text-xs font-black uppercase tracking-widest text-[#DC2626]">
                  {total} {total === 1 ? "STORY" : "STORIES"} IN {category.name.toUpperCase()}
                </span>
                <Link
                  href="/categories"
                  className="text-xs font-black uppercase tracking-wider text-[#DC2626] hover:underline flex items-center gap-1"
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
                  const href = articlePath(article.countrySlug, article.citySlug, article.slug);

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
                            <span className="text-slate-300">•</span>
                            <span className="text-slate-500">{category.name.toUpperCase()}</span>
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
              {/* Beat Dossier Card */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
                <h3 className="font-sans text-xs sm:text-sm font-black uppercase tracking-wider text-[#0B1527] mb-3 pb-2 border-b border-slate-100">
                  {category.name} Beat Dossier
                </h3>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="p-3 bg-slate-50 rounded-xl text-center">
                    <p className="text-xl font-black text-[#DC2626]">{total}</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase">Stories</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl text-center">
                    <p className="text-xl font-black text-[#0B1527]">Global</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase">Coverage</p>
                  </div>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Focus: <strong className="text-slate-900">{category.name} developments, openings, and reviews.</strong>
                </p>
              </div>

              {/* Browse Other Categories */}
              {allCategories.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
                  <h3 className="font-sans text-xs sm:text-sm font-black uppercase tracking-wider text-[#0B1527] mb-3 pb-2 border-b border-slate-100">
                    Other Editorial Beats
                  </h3>
                  <div className="flex flex-col gap-2">
                    {allCategories
                      .filter((c) => c.slug !== category.slug)
                      .slice(0, 5)
                      .map((cat) => (
                        <Link
                          key={cat.id}
                          href={`/categories/${cat.slug}`}
                          className="flex items-center justify-between py-1.5 text-xs text-slate-700 hover:text-[#DC2626] font-bold group"
                        >
                          <span>{cat.name}</span>
                          <span className="text-slate-400 group-hover:translate-x-0.5 transition-transform">→</span>
                        </Link>
                      ))}
                  </div>
                </div>
              )}

              {/* Have News in Category? Dark Box */}
              <div className="relative overflow-hidden rounded-2xl bg-[#0B1527] text-white p-6 shadow-md flex flex-col gap-3">
                <div className="absolute right-2 -bottom-2 opacity-15 pointer-events-none">
                  <svg className="w-24 h-24 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                </div>

                <h3 className="font-serif text-lg font-black text-white">
                  Cover {category.name}?
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed max-w-[260px]">
                  Submit your scoops, opening announcements, or photo reports on {category.name.toLowerCase()}.
                </p>
                <Link
                  href="/write-for-us"
                  className="mt-2 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#DC2626] py-2.5 px-4 text-xs font-black uppercase tracking-wider text-white hover:bg-[#B91C1C] transition-colors shadow-sm self-start"
                >
                  <span>WRITE FOR US</span>
                  <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* =========================================
          4. BOTTOM NEWSLETTER STRIP
      ========================================= */}
      <section className="mt-8">
        <Container>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-2xl shadow-sm">
                📬
              </div>
              <div>
                <h3 className="font-sans text-sm sm:text-base font-black text-[#0B1527]">
                  Stay Updated on {category.name}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500 leading-relaxed max-w-lg">
                  Get breaking ride announcements, queue strategies, and ticket updates delivered to your inbox.
                </p>
              </div>
            </div>

            <div className="w-full md:w-auto">
              <NewsletterForm source={`category-${category.slug}-footer`} variant="light" />
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}
