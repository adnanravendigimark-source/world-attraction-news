"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Container from "@/components/Container";

export interface ArticleItem {
  id: string;
  slug: string;
  citySlug?: string;
  cityName?: string;
  categoryName?: string;
  title: string;
  excerpt: string;
  authorName?: string;
  publishedAt: string;
  readingTimeMinutes?: number;
  image?: string;
  imageAlt?: string;
}

const DEFAULT_LATEST_ARTICLES: ArticleItem[] = [
  {
    id: "london-fireworks",
    slug: "london-eye-new-years-eve-fireworks",
    citySlug: "london",
    cityName: "LONDON",
    categoryName: "EVENTS & FESTIVALS",
    title: "New Year's Eve Fireworks on the Thames: What to Know if You're Near the London Eye",
    excerpt:
      "London's official New Year's Eve fireworks are launched from the London Eye and Thames-side locations — here's how it works.",
    authorName: "London Launch Editorial Team",
    publishedAt: "May 13, 2025",
    readingTimeMinutes: 3,
    image: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=800&q=80",
    imageAlt: "London Eye Fireworks",
  },
  {
    id: "fast-furious",
    slug: "universal-orlando-fast-and-furious-coaster",
    citySlug: "orlando",
    cityName: "ORLANDO",
    categoryName: "NEW ATTRACTIONS",
    title: "Universal Orlando Unveils First Look at New Fast & Furious Coaster",
    excerpt:
      "Universal Orlando Resort has released exciting details and concept art for its upcoming Fast & Furious roller coaster.",
    authorName: "Attraction News Team",
    publishedAt: "May 12, 2025",
    readingTimeMinutes: 4,
    image: "https://images.unsplash.com/photo-1513889961551-628c1e5e2ee9?auto=format&fit=crop&w=800&q=80",
    imageAlt: "Universal Studios Roller Coaster",
  },
  {
    id: "seaworld-aquarium",
    slug: "seaworld-orlando-aquarium-experience",
    citySlug: "orlando",
    cityName: "ORLANDO",
    categoryName: "ATTRACTIONS",
    title: "SeaWorld Orlando Adds New Aquarium Experience: Inside Look",
    excerpt:
      "SeaWorld Orlando has opened a brand-new immersive aquarium experience. Here's everything you can see inside.",
    authorName: "Attraction News Team",
    publishedAt: "May 12, 2025",
    readingTimeMinutes: 4,
    image: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=800&q=80",
    imageAlt: "Underwater Aquarium Experience",
  },
  {
    id: "paris-night-show",
    slug: "disneyland-paris-new-night-show-summer-2025",
    citySlug: "paris",
    cityName: "PARIS",
    categoryName: "OPENINGS & CLOSURES",
    title: "Disneyland Paris Announces New Night Show for Summer 2025",
    excerpt:
      "Disneyland Paris is set to dazzle guests with an all-new nighttime spectacular launching this summer.",
    authorName: "Attraction News Team",
    publishedAt: "May 11, 2025",
    readingTimeMinutes: 3,
    image: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=800&q=80",
    imageAlt: "Disneyland Paris Castle Fireworks",
  },
];

const TRENDING_SIDEBAR = [
  {
    id: "trend-1",
    num: 1,
    title: "Bastille Day Fireworks at the Eiffel Tower: What to Know",
    city: "PARIS",
    date: "May 11, 2025",
    image: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=300&q=80",
    href: "/latest-news/bastille-day-fireworks-eiffel-tower-what-to-know",
  },
  {
    id: "trend-2",
    num: 2,
    title: "Epic Universe Opens at Universal Orlando Resort",
    city: "ORLANDO",
    date: "May 10, 2025",
    image: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=300&q=80",
    href: "/latest-news/epic-universe-opens-universal-orlando",
  },
  {
    id: "trend-3",
    num: 3,
    title: "Tokyo DisneySea Fantasy Springs Expansion Opens June 6",
    city: "TOKYO",
    date: "May 10, 2025",
    image: "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=300&q=80",
    href: "/latest-news/tokyo-disneysea-fantasy-springs-expansion",
  },
  {
    id: "trend-4",
    num: 4,
    title: "Sagrada Familia Officially Completes Central Tower",
    city: "BARCELONA",
    date: "May 9, 2025",
    image: "https://images.unsplash.com/photo-1583422409516-2895a77efded?auto=format&fit=crop&w=300&q=80",
    href: "/latest-news/sagrada-familia-completion-timeline-revealed",
  },
  {
    id: "trend-5",
    num: 5,
    title: "Colosseum Underground Tours Now Include New Sections",
    city: "ROME",
    date: "May 9, 2025",
    image: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=300&q=80",
    href: "/latest-news/colosseum-underground-tours-new-sections",
  },
];

const FILTER_TAGS = [
  "ALL NEWS",
  "NEW ATTRACTIONS",
  "TICKETS & PRICING",
  "OPENINGS & CLOSURES",
  "EVENTS & FESTIVALS",
  "VISITOR TIPS",
];

const DESTINATIONS_LIST = [
  "All Destinations",
  "Orlando",
  "Paris",
  "Tokyo",
  "London",
  "Singapore",
  "Dubai",
  "Barcelona",
  "Rome",
];

const CATEGORIES_LIST = [
  "All Categories",
  "Theme Parks",
  "Water Parks",
  "Zoos & Aquariums",
  "Museums & Culture",
  "Iconic Landmarks",
];

export default function LatestNewsClient({
  initialArticles = [],
  totalCount = 4,
}: {
  initialArticles?: ArticleItem[];
  totalCount?: number;
}) {
  const [activeTag, setActiveTag] = useState("ALL NEWS");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [selectedDest, setSelectedDest] = useState("All Destinations");
  const [selectedCategory, setSelectedCategory] = useState("All Categories");
  const [selectedDate, setSelectedDate] = useState("");
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>([]);
  const [subscribed, setSubscribed] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const displayArticles = initialArticles.length >= 4 ? initialArticles : DEFAULT_LATEST_ARTICLES;

  const toggleBookmark = (id: string) => {
    setBookmarkedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const resetFilters = () => {
    setActiveTag("ALL NEWS");
    setSearchKeyword("");
    setSelectedDest("All Destinations");
    setSelectedCategory("All Categories");
    setSelectedDate("");
  };

  const filteredArticles = displayArticles.filter((a) => {
    if (activeTag !== "ALL NEWS") {
      const tagLower = activeTag.toLowerCase();
      const catLower = (a.categoryName || "").toLowerCase();
      if (!catLower.includes(tagLower) && !tagLower.includes(catLower)) {
        return false;
      }
    }
    if (searchKeyword) {
      const q = searchKeyword.toLowerCase();
      if (!a.title.toLowerCase().includes(q) && !a.excerpt.toLowerCase().includes(q)) {
        return false;
      }
    }
    if (selectedDest !== "All Destinations") {
      if ((a.cityName || "").toLowerCase() !== selectedDest.toLowerCase()) {
        return false;
      }
    }
    if (selectedCategory !== "All Categories") {
      if (!(a.categoryName || "").toLowerCase().includes(selectedCategory.toLowerCase())) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="bg-white min-h-screen text-[#0B1527] pb-16">
      {/* =========================================
          1. BREADCRUMBS & HERO WIRE HEADER
      ========================================= */}
      <div className="border-b border-slate-100 bg-white pt-5 pb-8">
        <Container>
          {/* Breadcrumbs */}
          <nav className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 mb-4">
            <Link href="/" className="hover:text-slate-900 transition-colors">
              Home
            </Link>
            <span>&gt;</span>
            <span className="text-slate-800">Latest News</span>
          </nav>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            {/* Left Title & Tagline */}
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

            {/* Right: Get the Latest Updates Box */}
            <div className="relative rounded-xl border border-rose-100/80 bg-rose-50/40 p-4 sm:p-5 lg:w-[380px] overflow-hidden">
              {/* Globe background illustration */}
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
              {subscribed ? (
                <div className="mt-2.5 p-1.5 bg-emerald-50 text-emerald-700 text-[11px] font-bold rounded text-center">
                  ✓ Subscribed successfully!
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
          2. FILTER PILLS & SORT TOOLBAR
      ========================================= */}
      <div className="py-5 border-b border-slate-100 bg-white">
        <Container>
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Tag Pills */}
            <div className="flex flex-wrap items-center gap-2">
              {FILTER_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setActiveTag(tag)}
                  className={`rounded-md px-3.5 py-1.5 text-[11px] font-extrabold uppercase tracking-wider transition-all ${
                    activeTag === tag
                      ? "bg-[#DC2626] text-white shadow-sm"
                      : "bg-white text-slate-700 border border-slate-200 hover:border-slate-400"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <span>Sort by:</span>
              <select className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-800 focus:border-[#DC2626] focus:outline-none cursor-pointer">
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
              {filteredArticles.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200">
                  <p className="font-bold text-slate-700">No stories match your filter criteria.</p>
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="mt-3 text-xs font-bold text-[#DC2626] hover:underline"
                  >
                    Reset all filters
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
                          src={article.image || "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=800&q=80"}
                          alt={article.imageAlt || article.title}
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      </Link>

                      {/* Content Right */}
                      <div className="flex flex-1 flex-col justify-between py-1">
                        <div>
                          {/* Eyebrow */}
                          <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider">
                            <span className="text-[#DC2626]">{article.cityName || "ORLANDO"}</span>
                            <span className="text-slate-300">•</span>
                            <span className="text-slate-500">{article.categoryName || "THEME PARKS"}</span>
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
                            <span>By {article.authorName || "Attraction News Team"}</span>
                            <span className="mx-1.5">•</span>
                            <span>{article.publishedAt}</span>
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
                {[1, 2, 3, 4, 5].map((pageNum) => (
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
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(5, p + 1))}
                  aria-label="Next page"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 text-xs font-bold"
                >
                  ›
                </button>
              </div>
            </div>

            {/* Right Column (32%): Refine Search & Trending Now */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              {/* Refine Your Search Card */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
                <h3 className="font-sans text-xs sm:text-sm font-black uppercase tracking-wider text-[#0B1527] mb-4">
                  Refine Your Search
                </h3>

                {/* Search News */}
                <div className="mb-4">
                  <label htmlFor="search-news-input" className="block text-xs font-bold text-slate-700 mb-1.5">
                    Search News
                  </label>
                  <div className="relative">
                    <input
                      id="search-news-input"
                      type="text"
                      value={searchKeyword}
                      onChange={(e) => setSearchKeyword(e.target.value)}
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

                {/* Destination Dropdown */}
                <div className="mb-4">
                  <label htmlFor="dest-dropdown" className="block text-xs font-bold text-slate-700 mb-1.5">
                    Destination
                  </label>
                  <select
                    id="dest-dropdown"
                    value={selectedDest}
                    onChange={(e) => setSelectedDest(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:border-[#DC2626] focus:bg-white focus:outline-none"
                  >
                    {DESTINATIONS_LIST.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Category Dropdown */}
                <div className="mb-4">
                  <label htmlFor="category-dropdown" className="block text-xs font-bold text-slate-700 mb-1.5">
                    Category
                  </label>
                  <select
                    id="category-dropdown"
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:border-[#DC2626] focus:bg-white focus:outline-none"
                  >
                    {CATEGORIES_LIST.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date Picker */}
                <div className="mb-5">
                  <label htmlFor="date-input" className="block text-xs font-bold text-slate-700 mb-1.5">
                    Date
                  </label>
                  <input
                    id="date-input"
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:border-[#DC2626] focus:bg-white focus:outline-none"
                  />
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    className="w-full rounded-lg bg-[#DC2626] py-2.5 text-xs font-black uppercase tracking-wider text-white shadow hover:bg-[#B91C1C] transition-colors"
                  >
                    APPLY FILTERS
                  </button>
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="text-center text-[11px] font-bold text-slate-500 hover:text-slate-800 py-1"
                  >
                    RESET
                  </button>
                </div>
              </div>

              {/* Trending Now Card */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-[#DC2626] text-sm">📈</span>
                  <h3 className="font-sans text-xs sm:text-sm font-black uppercase tracking-wider text-[#0B1527]">
                    Trending Now
                  </h3>
                </div>

                <div className="divide-y divide-slate-100">
                  {TRENDING_SIDEBAR.map((item) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      className="group flex items-center gap-3 py-3 hover:bg-slate-50/70 -mx-2 px-2 rounded-lg transition-colors"
                    >
                      {/* Rank Number */}
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0B1527] text-[10px] font-black text-white">
                        {item.num}
                      </span>

                      {/* Thumbnail */}
                      <div className="relative h-11 w-14 shrink-0 rounded-md overflow-hidden bg-slate-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.image}
                          alt={item.title}
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                        />
                      </div>

                      {/* Title & Metadata */}
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-[#0B1527] leading-snug line-clamp-2 group-hover:text-[#DC2626] transition-colors">
                          {item.title}
                        </h4>
                        <p className="mt-0.5 text-[10px] font-semibold text-slate-400 uppercase">
                          <span className="text-[#DC2626]">{item.city}</span> • {item.date}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}
