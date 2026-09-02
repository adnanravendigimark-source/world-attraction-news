"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Container from "@/components/Container";
import type { Category } from "@/lib/categories";
import type { ArticleWithRelations } from "@/lib/articles";

const FILTER_PILLS = [
  "ALL STORIES",
  "PARIS",
  "ORLANDO",
  "TOKYO",
  "LONDON",
  "BARCELONA",
  "AMSTERDAM",
];

export default function CategoryDetailClient({
  category,
  articles = [],
  allCategories = [],
}: {
  category: Category;
  articles?: ArticleWithRelations[];
  allCategories?: Category[];
}) {
  const [activePill, setActivePill] = useState("ALL STORIES");
  const [sortBy, setSortBy] = useState("latest");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>([]);
  const [subscribed, setSubscribed] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const toggleBookmark = (id: string) => {
    setBookmarkedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return "May 13, 2025";
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  // Default fallback articles if DB has fewer for this category
  const displayArticles = articles.length > 0 ? articles : [
    {
      id: `${category.slug}-story-1`,
      slug: `${category.slug}-major-expansions-and-developments-guide`,
      title: `${category.name}: New Expansions, Opening Dates, and Season Guide`,
      excerpt: `Comprehensive on-the-ground reporting on the latest debuts, ride technology, and visitor intelligence across ${category.name.toLowerCase()}.`,
      cityName: "ORLANDO",
      citySlug: "orlando",
      categoryName: category.name.toUpperCase(),
      authorName: "Attraction News Editorial Desk",
      publishedAt: "2025-05-13T10:00:00Z",
      readingTimeMinutes: 3,
      image: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=800&q=80",
    } as any,
    {
      id: `${category.slug}-story-2`,
      slug: `${category.slug}-global-highlights-and-visitor-tips`,
      title: `Global ${category.name} Highlights and Ticket Reservation Strategies`,
      excerpt: `Avoid long queues and save on ticket packages with our correspondent guide to top ${category.name.toLowerCase()} venues worldwide.`,
      cityName: "PARIS",
      citySlug: "paris",
      categoryName: category.name.toUpperCase(),
      authorName: "Paris Bureau Desk",
      publishedAt: "2025-05-11T12:00:00Z",
      readingTimeMinutes: 4,
      image: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=800&q=80",
    } as any,
    {
      id: `${category.slug}-story-3`,
      slug: `${category.slug}-upcoming-festivals-and-special-events`,
      title: `Upcoming ${category.name} Special Events and Anniversary Celebrations`,
      excerpt: `Explore seasonal parades, night shows, and exclusive visitor experiences premiering across global venues.`,
      cityName: "TOKYO",
      citySlug: "tokyo",
      categoryName: category.name.toUpperCase(),
      authorName: "Tokyo Bureau Desk",
      publishedAt: "2025-05-09T14:00:00Z",
      readingTimeMinutes: 2,
      image: "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=800&q=80",
    } as any,
  ];

  const filteredArticles = displayArticles.filter((article) => {
    if (searchKeyword) {
      const q = searchKeyword.toLowerCase();
      if (!article.title.toLowerCase().includes(q) && !article.excerpt.toLowerCase().includes(q)) {
        return false;
      }
    }
    if (activePill !== "ALL STORIES") {
      const pillLower = activePill.toLowerCase();
      const cityLower = (article.cityName || "").toLowerCase();
      if (!cityLower.includes(pillLower) && !article.title.toLowerCase().includes(pillLower)) {
        return false;
      }
    }
    return true;
  });

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
            <Link href="/categories" className="hover:text-slate-900 transition-colors">
              Categories
            </Link>
            <span>&gt;</span>
            <span className="text-slate-800">{category.name}</span>
          </nav>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            {/* Left Title & Tagline */}
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

            {/* Right: Subscribe Box */}
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
              {subscribed ? (
                <div className="mt-2.5 p-1.5 bg-emerald-50 text-emerald-700 text-[11px] font-bold rounded text-center">
                  ✓ Subscribed to {category.name} alerts!
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setSubscribed(true);
                  }}
                  className="mt-2.5 flex gap-1.5"
                >
                  <input
                    type="email"
                    required
                    placeholder="Enter your email"
                    className="flex-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#DC2626] focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="rounded-md bg-[#DC2626] px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#B91C1C] transition-colors shadow-sm"
                  >
                    SUBSCRIBE
                  </button>
                </form>
              )}
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
            {/* City Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
              {FILTER_PILLS.map((pill) => (
                <button
                  key={pill}
                  type="button"
                  onClick={() => setActivePill(pill)}
                  className={`whitespace-nowrap rounded-md px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-all ${
                    activePill === pill
                      ? "bg-[#DC2626] text-white shadow-sm"
                      : "bg-white text-slate-700 hover:bg-slate-200 border border-slate-200/80"
                  }`}
                >
                  {pill}
                </button>
              ))}
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              <span className="text-xs font-bold text-slate-500">Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="rounded-md border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-800 focus:border-[#DC2626] focus:outline-none cursor-pointer"
              >
                <option value="latest">Latest</option>
                <option value="popular">Most Popular</option>
                <option value="oldest">Oldest</option>
              </select>
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
                  {filteredArticles.length} STORIES IN {category.name.toUpperCase()}
                </span>
                <Link
                  href="/categories"
                  className="text-xs font-black uppercase tracking-wider text-[#DC2626] hover:underline flex items-center gap-1"
                >
                  <span>View All Categories</span>
                  <span aria-hidden="true">→</span>
                </Link>
              </div>

              {filteredArticles.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200">
                  <p className="font-bold text-slate-700">No stories found for this city.</p>
                  <button
                    type="button"
                    onClick={() => setActivePill("ALL STORIES")}
                    className="mt-3 text-xs font-bold text-[#DC2626] hover:underline"
                  >
                    View all stories
                  </button>
                </div>
              ) : (
                filteredArticles.map((article) => {
                  const isBookmarked = bookmarkedIds.includes(article.id);
                  const href = `/latest-news/${article.slug}`;

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
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={article.image || "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=800&q=80"}
                          alt={article.imageAlt || article.title}
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      </Link>

                      {/* Content Right */}
                      <div className="flex flex-1 flex-col justify-between py-1">
                        <div>
                          {/* Eyebrow */}
                          <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider">
                            <span className="text-[#DC2626]">{article.cityName || "GLOBAL"}</span>
                            <span className="text-slate-300">•</span>
                            <span className="text-slate-500">{category.name.toUpperCase()}</span>
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

                        {/* Author, Date & Bookmark */}
                        <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                          <div>
                            <span>By {article.authorName || "Attraction News Desk"}</span>
                            <span className="mx-1.5">•</span>
                            <span>{formatDate(article.publishedAt)}</span>
                            <span className="mx-1.5">•</span>
                            <span>{article.readingTimeMinutes || 3} min read</span>
                          </div>

                          <button
                            type="button"
                            onClick={() => toggleBookmark(article.id)}
                            aria-label="Bookmark article"
                            className="text-slate-400 hover:text-[#DC2626] transition-colors p-1"
                          >
                            {isBookmarked ? (
                              <svg className="h-4 w-4 fill-[#DC2626] text-[#DC2626]" viewBox="0 0 24 24">
                                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                              </svg>
                            ) : (
                              <svg className="h-4 w-4 fill-none stroke-current" strokeWidth="2" viewBox="0 0 24 24">
                                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })
              )}

              {/* Pagination */}
              <div className="mt-6 flex items-center justify-center gap-2">
                {[1, 2, 3].map((pageNum) => (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setCurrentPage(pageNum)}
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                      currentPage === pageNum
                        ? "bg-[#DC2626] text-white shadow-sm"
                        : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                    }`}
                  >
                    {pageNum}
                  </button>
                ))}
              </div>
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
                    <p className="text-xl font-black text-[#DC2626]">{displayArticles.length}</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase">Dispatches</p>
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

            <form action="/latest-news" className="flex w-full md:w-auto items-center gap-2">
              <input
                type="email"
                required
                placeholder="Enter your email address"
                className="w-full md:w-72 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#DC2626] focus:bg-white focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-lg bg-[#DC2626] px-5 py-2.5 text-xs font-black uppercase tracking-wider text-white hover:bg-[#B91C1C] transition-colors shadow-sm shrink-0"
              >
                SUBSCRIBE
              </button>
            </form>
          </div>
        </Container>
      </section>
    </div>
  );
}
