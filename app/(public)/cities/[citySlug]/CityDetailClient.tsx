"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Container from "@/components/Container";
import NewsletterForm from "@/components/NewsletterForm";
import EmptyState from "@/components/EmptyState";
import type { City } from "@/lib/cities";
import type { ArticleWithRelations } from "@/lib/articles";
import type { Attraction } from "@/lib/attractions";

const PAGE_SIZE = 10;
const ALL_TAG = "ALL NEWS";

export default function CityDetailClient({
  city,
  articles = [],
  attractions = [],
}: {
  city: City;
  articles?: ArticleWithRelations[];
  attractions?: Attraction[];
}) {
  const [activeTag, setActiveTag] = useState(ALL_TAG);
  const [sortBy, setSortBy] = useState<"latest" | "popular" | "oldest">("latest");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const formatDate = (iso: string | null) => {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  // Real category tags — only the ones this city actually has published
  // articles under, derived from the real data rather than a fixed list
  // that could show dead filters with zero matching results.
  const availableTags = useMemo(() => {
    const names = new Set<string>();
    for (const a of articles) if (a.categoryName) names.add(a.categoryName);
    return [ALL_TAG, ...Array.from(names).sort()];
  }, [articles]);

  const filteredArticles = useMemo(() => {
    const filtered = articles.filter((article) => {
      if (searchKeyword) {
        const q = searchKeyword.toLowerCase();
        if (!article.title.toLowerCase().includes(q) && !(article.excerpt || "").toLowerCase().includes(q)) {
          return false;
        }
      }
      if (activeTag !== ALL_TAG && article.categoryName !== activeTag) {
        return false;
      }
      return true;
    });

    const sorted = [...filtered];
    if (sortBy === "oldest") {
      sorted.sort((a, b) => new Date(a.publishedAt || 0).getTime() - new Date(b.publishedAt || 0).getTime());
    } else if (sortBy === "popular") {
      sorted.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0) || (b.score || 0) - (a.score || 0));
    } else {
      sorted.sort((a, b) => new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime());
    }
    return sorted;
  }, [articles, searchKeyword, activeTag, sortBy]);

  // Real pagination over the filtered set, not a decorative fixed [1,2,3].
  const totalPages = Math.max(1, Math.ceil(filteredArticles.length / PAGE_SIZE));
  useEffect(() => {
    setCurrentPage(1);
  }, [searchKeyword, activeTag, sortBy]);
  const page = Math.min(currentPage, totalPages);
  const pagedArticles = filteredArticles.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1).slice(
    Math.max(0, Math.min(page - 3, totalPages - 5)),
    Math.max(0, Math.min(page - 3, totalPages - 5)) + 5
  );

  return (
    <div className="bg-white min-h-screen text-[#0B1527] pb-16">
      {/* =========================================
          1. BREADCRUMBS & HERO HEADER
      ========================================= */}
      <div className="border-b border-slate-100 bg-white pt-5 pb-8">
        <Container>
          {/* Breadcrumbs */}
          <nav className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 mb-4">
            <Link href="/" className="hover:text-slate-900 transition-colors">
              Home
            </Link>
            <span>&gt;</span>
            <Link href="/cities" className="hover:text-slate-900 transition-colors">
              Destinations
            </Link>
            <span>&gt;</span>
            <span className="text-slate-800">{city.name}</span>
          </nav>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            {/* Left Title & Tagline */}
            <div className="max-w-xl">
              <div className="flex items-center gap-2 mb-2">
                <span className="h-2 w-2 rounded-full bg-[#DC2626] animate-pulse" />
                <span className="text-[11px] font-black uppercase tracking-widest text-[#DC2626]">
                  {city.name.toUpperCase()} BUREAU • {city.country.toUpperCase()}
                </span>
              </div>
              <h1 className="font-serif text-3xl sm:text-4xl lg:text-[44px] font-black tracking-tight text-[#0B1527]">
                {city.name} Attraction News
              </h1>
              <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
                {city.intro || `Verified on-the-ground reporting, theme park expansions, and visitor updates from our ${city.name} correspondents.`}
              </p>
            </div>

            {/* Right: Subscribe Box */}
            <div className="relative rounded-xl border border-rose-100/80 bg-rose-50/40 p-4 sm:p-5 lg:w-[380px] overflow-hidden">
              <div className="absolute right-2 -bottom-4 opacity-15 pointer-events-none">
                <svg className="w-32 h-32 text-rose-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              </div>

              <h3 className="font-sans text-xs font-black uppercase tracking-wider text-[#0B1527]">
                GET {city.name.toUpperCase()} ALERTS
              </h3>
              <p className="mt-1 text-[11px] text-slate-500 leading-normal">
                Stay updated on city guides, ticket changes, and new openings in {city.name}.
              </p>
              <div className="mt-2.5">
                <NewsletterForm source={`city-${city.slug}`} variant="light" />
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
            {/* Tag Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
              {availableTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setActiveTag(tag)}
                  className={`whitespace-nowrap rounded-md px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-all ${
                    activeTag === tag
                      ? "bg-[#DC2626] text-white shadow-sm"
                      : "bg-white text-slate-700 hover:bg-slate-200 border border-slate-200/80"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>

            {/* Search & Sort */}
            <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
              <div className="relative">
                <input
                  type="text"
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  placeholder="Search stories..."
                  aria-label={`Search stories in ${city.name}`}
                  className="w-36 sm:w-48 rounded-md border border-slate-200 bg-white pl-7 pr-2.5 py-1 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#DC2626] focus:outline-none"
                />
                <svg
                  className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path strokeLinecap="round" d="m21 21-4.3-4.3" />
                </svg>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 hidden sm:inline">Sort by:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as "latest" | "popular" | "oldest")}
                  className="rounded-md border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-800 focus:border-[#DC2626] focus:outline-none cursor-pointer"
                >
                  <option value="latest">Latest</option>
                  <option value="popular">Most Popular</option>
                  <option value="oldest">Oldest</option>
                </select>
              </div>
            </div>
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
                  {filteredArticles.length} STORIES IN {city.name.toUpperCase()}
                </span>
                <Link
                  href={`/cities/${city.slug}/attractions`}
                  className="text-xs font-black uppercase tracking-wider text-[#DC2626] hover:underline flex items-center gap-1"
                >
                  <span>View All {city.name} Attractions</span>
                  <span aria-hidden="true">→</span>
                </Link>
              </div>

              {filteredArticles.length === 0 ? (
                <div>
                  <EmptyState
                    title={articles.length === 0 ? "No stories published yet" : "No stories found for this tag"}
                    description={
                      articles.length === 0
                        ? `Check back soon for the latest attraction news from ${city.name}.`
                        : "Try a different tag, or clear your search."
                    }
                  />
                  {(activeTag !== ALL_TAG || searchKeyword) && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTag(ALL_TAG);
                        setSearchKeyword("");
                      }}
                      className="mt-3 text-xs font-bold text-[#DC2626] hover:underline"
                    >
                      Reset filters
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {pagedArticles.map((article) => {
                    const href = `/cities/${city.slug}/${article.slug}`;

                    return (
                      <article
                        key={article.id}
                        className="group flex flex-col sm:flex-row items-stretch gap-4 sm:gap-6 bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md hover:border-slate-300 transition-all"
                      >
                        {/* Image Thumbnail */}
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

                        {/* Content Right */}
                        <div className="flex flex-1 flex-col justify-between py-1">
                          <div>
                            {/* Eyebrow */}
                            <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider">
                              <span className="text-[#DC2626]">{city.name.toUpperCase()}</span>
                              {article.categoryName && (
                                <>
                                  <span className="text-slate-300">•</span>
                                  <span className="text-slate-500">{article.categoryName.toUpperCase()}</span>
                                </>
                              )}
                            </div>

                            {/* Title */}
                            <h2 className="mt-1.5 font-sans text-base sm:text-lg font-black leading-snug text-[#0B1527] group-hover:text-[#DC2626] transition-colors">
                              <Link href={href}>{article.title}</Link>
                            </h2>

                            {/* Excerpt */}
                            <p className="mt-2 text-xs sm:text-[13px] leading-relaxed text-slate-600 line-clamp-2">
                              {article.excerpt}
                            </p>
                          </div>

                          {/* Author & Date */}
                          <div className="mt-3.5 pt-3 border-t border-slate-100 text-[11px] text-slate-500">
                            <span>By {article.authorName}</span>
                            <span className="mx-1.5">•</span>
                            <span>{formatDate(article.publishedAt)}</span>
                            <span className="mx-1.5">•</span>
                            <span>{article.readingTimeMinutes || 3} min read</span>
                          </div>
                        </div>
                      </article>
                    );
                  })}

                  {/* Pagination — real, computed from the filtered result set */}
                  {totalPages > 1 && (
                    <div className="mt-6 flex items-center justify-center gap-2">
                      <button
                        type="button"
                        disabled={page <= 1}
                        onClick={() => setCurrentPage(page - 1)}
                        aria-label="Previous page"
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none"
                      >
                        ‹
                      </button>
                      {pageNumbers.map((pageNum) => (
                        <button
                          key={pageNum}
                          type="button"
                          onClick={() => setCurrentPage(pageNum)}
                          className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                            page === pageNum
                              ? "bg-[#DC2626] text-white shadow-sm"
                              : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                          }`}
                        >
                          {pageNum}
                        </button>
                      ))}
                      <button
                        type="button"
                        disabled={page >= totalPages}
                        onClick={() => setCurrentPage(page + 1)}
                        aria-label="Next page"
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none"
                      >
                        ›
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Right Sidebar (32% / 4 cols) */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              {/* Bureau Dossier Card */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
                <h3 className="font-sans text-xs sm:text-sm font-black uppercase tracking-wider text-[#0B1527] mb-3 pb-2 border-b border-slate-100">
                  {city.name} Bureau Dossier
                </h3>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="p-3 bg-slate-50 rounded-xl text-center">
                    <p className="text-xl font-black text-[#DC2626]">{attractions.length}</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase">Attractions</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl text-center">
                    <p className="text-xl font-black text-[#0B1527]">{articles.length}</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase">Dispatches</p>
                  </div>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Country: <strong className="text-slate-900">{city.country}</strong>
                </p>
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <Link
                    href={`/cities/${city.slug}/attractions`}
                    className="text-xs font-black uppercase tracking-wider text-[#DC2626] flex items-center gap-1 hover:underline"
                  >
                    <span>Browse {city.name} Attractions</span>
                    <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </div>

              {/* Top Attractions in City */}
              {attractions.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
                  <h3 className="font-sans text-xs sm:text-sm font-black uppercase tracking-wider text-[#0B1527] mb-4 pb-2 border-b border-slate-100">
                    Key Attractions in {city.name}
                  </h3>
                  <div className="flex flex-col gap-3.5">
                    {attractions.slice(0, 5).map((att) => (
                      <Link
                        key={att.id}
                        href={`/cities/${city.slug}/attractions/${att.slug}`}
                        className="group flex items-center gap-3"
                      >
                        <div className="relative h-12 w-12 shrink-0 rounded-lg overflow-hidden bg-slate-100">
                          {att.heroImage ? (
                            <Image
                              src={att.heroImage}
                              alt={att.name}
                              fill
                              sizes="48px"
                              className="object-cover group-hover:scale-105 transition-transform"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-[#0B1527] text-[9px] font-bold text-white/50">
                              {att.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-sans text-xs font-bold text-[#0B1527] line-clamp-1 group-hover:text-[#DC2626] transition-colors">
                            {att.name}
                          </h4>
                          <span className="text-[10px] text-[#DC2626] font-bold">
                            Explore Venue →
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Have News from City? Dark Box */}
              <div className="relative overflow-hidden rounded-2xl bg-[#0B1527] text-white p-6 shadow-md flex flex-col gap-3">
                <div className="absolute right-2 -bottom-2 opacity-15 pointer-events-none">
                  <svg className="w-24 h-24 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                </div>

                <h3 className="font-serif text-lg font-black text-white">
                  Have News from {city.name}?
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed max-w-[260px]">
                  Submit your attraction scoops, photo reports, or opening tips for {city.name}.
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
                  Stay Updated on {city.name} Attractions
                </h3>
                <p className="mt-0.5 text-xs text-slate-500 leading-relaxed max-w-lg">
                  Get breaking ride announcements, queue strategies, and ticket updates delivered to your inbox.
                </p>
              </div>
            </div>

            <div className="w-full md:w-auto">
              <NewsletterForm source={`city-${city.slug}-footer`} variant="light" />
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}
