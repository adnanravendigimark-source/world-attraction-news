import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import Container from "@/components/Container";
import HomeHeroCarousel, { type HeroSlide } from "@/components/HomeHeroCarousel";
import NewsletterForm from "@/components/NewsletterForm";
import CategoryIcon, { categoryTint } from "@/components/CategoryIcon";
import { getCitiesWithArticleCounts } from "@/lib/cities";
import { getCategories, pickFeaturedCategories } from "@/lib/categories";
import { getFeaturedCategorySlugs } from "@/lib/settings";
import {
  getPublishedArticles,
  getPublishedNews,
  getFeaturedStories,
  getTrendingStories,
  getPublishedArticleCountsByCategory,
} from "@/lib/articles";
import { resolvePageMetadata, websiteJsonLd, jsonLdScript } from "@/lib/seo";
import { pickHeroStories, pickDestinations, popularCategories, storyHref, storyDate, readTime, storyLabel } from "@/lib/home";
import { SITE_NAME, SITE_DESCRIPTION, SITE_TAGLINE } from "@/lib/site";

// Cached for 60s; publishing or (un)featuring an article clears the
// "homepage" tag so changes show at once (see the admin article routes).
export const revalidate = 60;

const getHomePageData = unstable_cache(
  async () => {
    const [cities, categories, featuredCategorySlugs, categoryCounts, guides, news, featured, trending] = await Promise.all([
      getCitiesWithArticleCounts().catch(() => []),
      getCategories().catch(() => []),
      getFeaturedCategorySlugs().catch(() => [] as string[]),
      getPublishedArticleCountsByCategory().catch(() => ({} as Record<string, number>)),
      getPublishedArticles({ limit: 12 }).catch(() => []),
      getPublishedNews({ limit: 12 })
        .then((r) => r.articles)
        .catch(() => []),
      getFeaturedStories(4).catch(() => []),
      getTrendingStories(5).catch(() => []),
    ]);
    return { cities, categories, featuredCategorySlugs, categoryCounts, guides, news, featured, trending };
  },
  ["homepage-data-v3"],
  { revalidate: 60, tags: ["homepage"] }
);

export async function generateMetadata(): Promise<Metadata> {
  return resolvePageMetadata("/", {
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
  });
}

export default async function HomePage() {
  const { cities, categories, featuredCategorySlugs, categoryCounts, guides, news, featured, trending } = await getHomePageData();

  const heroSlides: HeroSlide[] = pickHeroStories(featured, guides).map((a) => ({
    id: a.id,
    eyebrow: a.featured ? "FEATURED" : a.type === "news" ? "TRAVEL NEWS" : "TRAVEL GUIDE",
    title: a.title,
    excerpt: a.excerpt,
    date: storyDate(a.publishedAt),
    readTime: readTime(a),
    image: a.image,
    imageAlt: a.imageAlt || a.title,
    href: storyHref(a),
  }));
  // Category pills: the admin's "Top categories" (Admin -> Header), else the first five.
  const quickCategories = pickFeaturedCategories(categories, featuredCategorySlugs).slice(0, 5);
  const latestNews = news.slice(0, 3);
  const destinations = pickDestinations(cities, [...guides, ...news]);
  const sidebarCategories = popularCategories(categories, categoryCounts, 6);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(websiteJsonLd()) }}
      />

      <div className="bg-white text-ink-900">
        {/* =========================================
            1. HERO CAROUSEL SECTION
        ========================================= */}
        {heroSlides.length > 0 ? (
          <section className="w-full">
            <HomeHeroCarousel slides={heroSlides} />
          </section>
        ) : (
          <h1 className="sr-only">
            {SITE_NAME}: {SITE_TAGLINE}
          </h1>
        )}

        {/* =========================================
            2. CATEGORY QUICK NAV / ICON PILLS BAR
        ========================================= */}
        {quickCategories.length > 0 && (
        <section className="w-full my-6">
          <Container>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
              {quickCategories.map((cat) => (
                <Link
                  key={cat.slug}
                  href={`/categories/${cat.slug}`}
                  className="group flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3 sm:p-3.5 shadow-2xs hover:shadow-md hover:border-gray-200 hover:-translate-y-0.5 transition-all duration-200"
                >
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${categoryTint(cat.slug)} transition-transform group-hover:scale-105`}>
                    <CategoryIcon slug={cat.slug} />
                  </div>
                  <span className="text-xs sm:text-sm font-semibold text-ink-800 group-hover:text-signal transition-colors truncate">
                    {cat.name}
                  </span>
                </Link>
              ))}
            </div>
          </Container>
        </section>
        )}

        {/* =========================================
            3. MAIN CONTENT: 2-COLUMN LAYOUT
        ========================================= */}
        <section className="w-full py-4 sm:py-6 pb-16">
          <Container>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
              {/* =========================================
                  LEFT COLUMN (8 COLUMNS)
              ========================================= */}
              <div className="lg:col-span-8 space-y-10 sm:space-y-12">
                {/* -----------------------------------------
                    SECTION: LATEST TRAVEL NEWS
                ----------------------------------------- */}
                {latestNews.length > 0 && (
                <div>
                  {/* Heading */}
                  <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                    <div className="flex items-center">
                      <span className="h-5 w-1 bg-signal rounded-full inline-block mr-2.5" />
                      <h2 className="font-serif text-2xl font-bold text-ink-900 tracking-tight">
                        Latest Travel News
                      </h2>
                    </div>
                    <Link
                      href="/news"
                      className="text-xs text-gray-500 hover:text-signal font-medium flex items-center gap-1 transition-colors group"
                    >
                      <span>View all news</span>
                      <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">→</span>
                    </Link>
                  </div>

                  {/* 3-Card Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-5">
                    {latestNews.map((item) => (
                      <article key={item.id} className="group flex flex-col justify-between">
                        <div>
                          {/* Image */}
                          <Link href={storyHref(item)} className="relative block aspect-[16/10] w-full overflow-hidden rounded-xl bg-gray-100 shadow-2xs">
                            {item.image && (
                            <Image
                              src={item.image}
                              alt={item.imageAlt || item.title}
                              fill
                              sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 100vw"
                              className="object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                            )}
                          </Link>

                          {/* Category Tag */}
                          <div className="mt-3.5">
                            <span className="text-[10.5px] font-bold uppercase tracking-wider text-signal">
                              {storyLabel(item)}
                            </span>
                          </div>

                          {/* Title */}
                          <h3 className="mt-1.5 font-serif text-[17px] font-bold leading-snug text-ink-900 group-hover:text-signal transition-colors line-clamp-3">
                            <Link href={storyHref(item)}>{item.title}</Link>
                          </h3>

                          {/* Meta */}
                          <p className="mt-2 text-xs text-gray-500 font-normal">
                            {[storyDate(item.publishedAt), readTime(item)].filter(Boolean).join(" • ")}
                          </p>

                          {/* Excerpt */}
                          <p className="mt-2.5 text-xs leading-relaxed text-gray-500 line-clamp-3">
                            {item.excerpt}
                          </p>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
                )}

                {/* -----------------------------------------
                    SECTION: FEATURED DESTINATIONS
                ----------------------------------------- */}
                {destinations.length > 0 && (
                <div>
                  {/* Heading */}
                  <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                    <div className="flex items-center">
                      <span className="h-5 w-1 bg-signal rounded-full inline-block mr-2.5" />
                      <h2 className="font-serif text-2xl font-bold text-ink-900 tracking-tight">
                        Featured Destinations
                      </h2>
                    </div>
                    <Link
                      href="/destinations"
                      className="text-xs text-gray-500 hover:text-signal font-medium flex items-center gap-1 transition-colors group"
                    >
                      <span>View all destinations</span>
                      <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">→</span>
                    </Link>
                  </div>

                  {/* 4-Card Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5">
                    {destinations.map((dest) => {
                      return (
                        <Link
                          key={dest.slug}
                          href={dest.href}
                          className="group flex flex-col"
                        >
                          {/* Image */}
                          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-gray-100 shadow-2xs">
                            <Image
                              src={dest.image}
                              alt={dest.imageAlt}
                              fill
                              sizes="(min-width: 1024px) 18vw, (min-width: 640px) 25vw, 50vw"
                              className="object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                          </div>

                          {/* Tag */}
                          <div className="mt-2.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-signal">
                              {dest.country}
                            </span>
                          </div>

                          {/* Name */}
                          <h3 className="mt-0.5 font-sans text-base font-bold text-ink-900 group-hover:text-signal transition-colors">
                            {dest.name}
                          </h3>

                          {/* Description */}
                          <p className="mt-1 text-xs leading-snug text-gray-500 line-clamp-2">
                            {dest.description}
                          </p>
                        </Link>
                      );
                    })}
                  </div>
                </div>
                )}

                {/* -----------------------------------------
                    SECTION: PLAN YOUR NEXT ADVENTURE BANNER
                ----------------------------------------- */}
                <div className="relative h-[260px] sm:h-[280px] w-full overflow-hidden rounded-2xl sm:rounded-3xl shadow-md group">
                  {/* Background Image */}
                  <Image
                    src="/images/adventure-banner.jpg"
                    alt="Plan your next adventure on the Mediterranean coast"
                    fill
                    sizes="(min-width: 1024px) 66vw, 100vw"
                    className="object-cover object-center transition-transform duration-700 group-hover:scale-102"
                  />

                  {/* Left Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-r from-[#0b1930]/90 via-[#0b1930]/65 to-transparent" />

                  {/* Content */}
                  <div className="relative z-10 flex h-full max-w-sm sm:max-w-md flex-col justify-center p-6 sm:p-10 text-white">
                    <span className="text-xs font-bold uppercase tracking-wider text-white/90 mb-1.5">
                      TRAVEL GUIDES
                    </span>
                    <h2 className="font-serif text-2xl sm:text-3xl font-bold leading-tight text-white mb-2.5">
                      Plan Your Next Adventure
                    </h2>
                    <p className="text-xs sm:text-sm text-gray-200 leading-relaxed mb-5">
                      Explore our detailed travel guides, insider tips and destination advice to make the most of your next trip.
                    </p>
                    <div>
                      <Link
                        href="/latest-news"
                        className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-xs font-semibold text-ink-950 shadow-sm transition hover:bg-gray-100"
                      >
                        <span>Explore Travel Guides</span>
                        <span aria-hidden="true" className="font-bold">→</span>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>

              {/* =========================================
                  RIGHT COLUMN: SIDEBAR (4 COLUMNS)
              ========================================= */}
              <aside className="lg:col-span-4 space-y-6">
                {/* -----------------------------------------
                    WIDGET 1: TRENDING NOW
                ----------------------------------------- */}
                {trending.length > 0 && (
                <div className="rounded-2xl border border-gray-100 bg-[#f8fafc]/60 p-5 shadow-2xs">
                  {/* Title */}
                  <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-200/60">
                    <span className="text-signal">
                      <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                        <path d="M12.87 2.08a.75.75 0 00-.74.03C11.5 2.5 10 3.75 9 5.5c-1.3 2.27-1.4 4.54-.3 6.64.12.24.08.52-.1.72-.18.2-.46.26-.71.16-1.57-.65-2.7-1.92-3.3-3.41a.75.75 0 00-1.37.47c.22 3.1 1.63 6.2 3.8 8.1 2.3 2.01 5.2 2.92 8.08 2.32 3.52-.73 6.2-3.64 6.7-7.23.47-3.39-.95-6.66-3.7-8.91-1.42-1.16-3.04-1.96-4.73-2.31a.75.75 0 00-.81.02z" />
                      </svg>
                    </span>
                    <h3 className="font-sans text-base font-bold text-ink-900 tracking-tight">
                      Trending Now
                    </h3>
                  </div>

                  {/* List of 5 items */}
                  <div className="space-y-3.5">
                    {trending.map((item, i) => (
                      <Link
                        key={item.id}
                        href={storyHref(item)}
                        className="group flex items-center gap-3 p-1 rounded-xl transition hover:bg-white hover:shadow-2xs"
                      >
                        {/* Number */}
                        <span className="text-sm font-bold text-gray-700 w-3.5 shrink-0 text-center">
                          {i + 1}
                        </span>

                        {/* Thumbnail */}
                        <div className="relative h-13 w-13 shrink-0 overflow-hidden rounded-lg bg-gray-100 shadow-2xs">
                          {item.image && (
                          <Image
                            src={item.image}
                            alt={item.imageAlt || item.title}
                            fill
                            sizes="56px"
                            className="object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                          )}
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-sans text-xs font-bold text-ink-900 group-hover:text-signal transition-colors line-clamp-2 leading-snug">
                            {item.title}
                          </h4>
                          <p className="mt-1 text-[11px] text-gray-500">
                            {[storyDate(item.publishedAt), readTime(item)].filter(Boolean).join(" • ")}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
                )}

                {/* -----------------------------------------
                    WIDGET 2: GET TRAVEL UPDATES IN YOUR INBOX
                ----------------------------------------- */}
                <div className="relative overflow-hidden rounded-2xl border border-sky-100 bg-[#f0f6fa] p-5 sm:p-6 shadow-2xs">
                  {/* Airmail passport stamp watermark */}
                  <div className="pointer-events-none absolute -right-3 -top-3 text-sky-900/10">
                    <svg className="h-28 w-28" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <circle cx="50" cy="50" r="45" strokeDasharray="3 3" />
                      <circle cx="50" cy="50" r="38" />
                      <path d="M50 20 L55 40 L75 45 L55 50 L50 70 L45 50 L25 45 L45 40 Z" fill="currentColor" fillOpacity="0.08" />
                      <path d="M22 65 C32 55 68 55 78 65" strokeWidth="1" />
                    </svg>
                  </div>

                  {/* Mail icon */}
                  <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-sky-100 text-sky-600">
                    <svg className="h-4.5 w-4.5 fill-none stroke-current" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>

                  {/* Title & Description */}
                  <h3 className="font-sans text-base font-bold text-ink-900">
                    Get Travel Updates in Your Inbox
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-gray-500">
                    Be the first to know about the latest travel news, destinations and exclusive tips.
                  </p>

                  {/* Newsletter Form */}
                  <div className="mt-4">
                    <NewsletterForm source="homepage-sidebar" variant="light" />
                  </div>
                </div>

                {/* -----------------------------------------
                    WIDGET 3: POPULAR CATEGORIES
                ----------------------------------------- */}
                {sidebarCategories.length > 0 && (
                <div className="rounded-2xl border border-gray-100 bg-[#f8fafc] p-5 shadow-2xs">
                  <h3 className="font-sans text-base font-bold text-ink-900 mb-3 pb-2 border-b border-gray-200/60">
                    Popular Categories
                  </h3>

                  <div className="space-y-1">
                    {sidebarCategories.map((cat) => (
                      <Link
                        key={cat.slug}
                        href={`/categories/${cat.slug}`}
                        className="group flex items-center justify-between py-2.5 px-2.5 rounded-lg text-xs font-semibold text-gray-700 hover:text-signal hover:bg-white transition-all cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-gray-500 group-hover:text-signal transition-colors">
                            <CategoryIcon slug={cat.slug} />
                          </span>
                          <span>{cat.name}</span>
                        </div>
                        <span aria-hidden="true" className="text-gray-400 group-hover:text-signal group-hover:translate-x-0.5 transition-all font-bold">
                          →
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
                )}
              </aside>
            </div>
          </Container>
        </section>
      </div>
    </>
  );
}
