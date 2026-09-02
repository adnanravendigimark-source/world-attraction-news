import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import Container from "@/components/Container";
import HomeHeroCarousel from "@/components/HomeHeroCarousel";
import { getCitiesWithArticleCounts } from "@/lib/cities";
import { getCategories } from "@/lib/categories";
import {
  getPublishedArticles,
  getTrendingArticles,
  getFeaturedArticles,
  getEditorsPickArticles,
  getBreakingArticles,
} from "@/lib/articles";
import { buildMetadata, websiteJsonLd } from "@/lib/seo";
import { getSettings } from "@/lib/settings";
import { SITE_NAME, SITE_DESCRIPTION, SITE_TAGLINE } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return buildMetadata({
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION || settings.defaultMetaDescription,
    path: "/",
    image: settings.defaultOgImage || undefined,
    noIndex: settings.robotsDefault === "noindex",
  });
}

function formatDate(iso: string | null) {
  if (!iso) return "May 13, 2025";
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "May 13, 2025";
  }
}

// Curated Latest News items matching mockup precisely
const DEFAULT_LATEST_NEWS = [
  {
    id: "disneyland-paris-show",
    tag: "DISNEYLAND PARIS",
    title: "Disneyland Paris Announces New Nighttime Show for Summer 2025",
    date: "May 13, 2025",
    readTime: "3 min read",
    image: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=800&q=80",
    imageAlt: "Disneyland Paris Castle Night Show",
    href: "/latest-news/disneyland-paris-new-night-show-summer",
  },
  {
    id: "universal-coaster",
    tag: "UNIVERSAL ORLANDO",
    title: "Universal Studios Hollywood Unveils First Look at New Fast & Furious Coaster",
    date: "May 13, 2025",
    readTime: "2 min read",
    image: "https://images.unsplash.com/photo-1513889961551-628c1e5e2ee9?auto=format&fit=crop&w=800&q=80",
    imageAlt: "Universal Studios Roller Coaster",
    href: "/latest-news/universal-studios-hollywood-fast-and-furious-coaster",
  },
  {
    id: "seaworld-aquarium",
    tag: "SEA LIFE",
    title: "SeaWorld Orlando Adds New Aquarium Experience: Inside Look",
    date: "May 12, 2025",
    readTime: "4 min read",
    image: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=800&q=80",
    imageAlt: "SeaWorld Aquarium Experience",
    href: "/latest-news/seaworld-orlando-adds-new-aquarium-experience",
  },
  {
    id: "europa-park-50",
    tag: "EUROPA-PARK",
    title: "Europa-Park Celebrates 50 Years with New Parade and Attractions",
    date: "May 12, 2025",
    readTime: "3 min read",
    image: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=800&q=80",
    imageAlt: "Europa-Park Mascot and Attractions",
    href: "/latest-news/europa-park-celebrates-50-years",
  },
];

// Curated Popular Destinations matching mockup (Orlando, Paris, Tokyo, Singapore, Dubai, London)
const POPULAR_DESTINATIONS = [
  {
    name: "Orlando",
    slug: "orlando",
    image: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=800&q=80",
    alt: "Orlando Theme Parks",
  },
  {
    name: "Paris",
    slug: "paris",
    image: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=800&q=80",
    alt: "Paris Eiffel Tower",
  },
  {
    name: "Tokyo",
    slug: "tokyo",
    image: "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=800&q=80",
    alt: "Tokyo Pagoda & Fuji",
  },
  {
    name: "Singapore",
    slug: "singapore",
    image: "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?auto=format&fit=crop&w=800&q=80",
    alt: "Singapore Marina Bay Sands",
  },
  {
    name: "Dubai",
    slug: "dubai",
    image: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=800&q=80",
    alt: "Dubai Skyline Burj Khalifa",
  },
  {
    name: "London",
    slug: "london",
    image: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=800&q=80",
    alt: "London Eye & Big Ben",
  },
];

// Curated Top Attractions list matching mockup
const TOP_ATTRACTIONS = [
  {
    rank: 1,
    title: "Wizarding World of Harry Potter",
    subtitle: "Universal Orlando Resort",
    location: "ORLANDO",
    image: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=400&q=80",
    href: "/cities/orlando",
  },
  {
    rank: 2,
    title: "Avengers Campus",
    subtitle: "Disney California Adventure",
    location: "CALIFORNIA",
    image: "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=400&q=80",
    href: "/cities/orlando",
  },
  {
    rank: 3,
    title: "Tokyo DisneySea",
    subtitle: "Tokyo Disney Resort",
    location: "TOKYO",
    image: "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=400&q=80",
    href: "/cities/tokyo",
  },
  {
    rank: 4,
    title: "Gardens by the Bay",
    subtitle: "Singapore",
    location: "SINGAPORE",
    image: "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?auto=format&fit=crop&w=400&q=80",
    href: "/cities/singapore",
  },
  {
    rank: 5,
    title: "The London Eye",
    subtitle: "London",
    location: "LONDON",
    image: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=400&q=80",
    href: "/cities/london",
  },
];

const TRENDING_TOPICS = [
  { name: "Opening Soon", href: "/categories/theme-parks" },
  { name: "Tickets & Prices", href: "/latest-news" },
  { name: "Ride Updates", href: "/categories/theme-parks" },
  { name: "Park News", href: "/latest-news" },
  { name: "Events & Festivals", href: "/categories" },
  { name: "Construction Updates", href: "/latest-news" },
];

export default async function HomePage() {
  const [
    cities,
    categories,
    articles,
    trending,
    featured,
    editorsPicks,
  ] = await Promise.all([
    getCitiesWithArticleCounts(),
    getCategories(),
    getPublishedArticles({ limit: 20 }),
    getTrendingArticles(6),
    getFeaturedArticles(6),
    getEditorsPickArticles(4),
  ]);

  // Map top 5 published articles to the editorial hero grid
  const heroSourceArticles = trending.length >= 4 ? trending.slice(0, 5) : (articles.length >= 4 ? articles.slice(0, 5) : []);
  const dynamicHeroSlides = heroSourceArticles.length >= 4
    ? heroSourceArticles.map((a) => ({
        id: a.id,
        eyebrow: `${a.cityName ? a.cityName.toUpperCase() + " BUREAU" : "TOP STORY"}`,
        cityName: a.cityName ? a.cityName.toUpperCase() : "GLOBAL",
        categoryName: a.categoryName ? a.categoryName.toUpperCase() : "ATTRACTIONS",
        title: a.title,
        excerpt: a.excerpt,
        author: a.authorName || "Attraction News Team",
        date: formatDate(a.publishedAt),
        readTime: `${a.readingTimeMinutes || 4} min read`,
        image: a.image || "/images/epic-universe.jpg",
        imageAlt: a.imageAlt || a.title,
        href: `/latest-news/${a.slug}`,
      }))
    : undefined;

  const latestNewsList = articles.length >= 5
    ? articles.slice(1, 5).map((a) => ({
        id: a.id,
        tag: a.categoryName?.toUpperCase() || a.cityName?.toUpperCase() || "THEME PARKS",
        title: a.title,
        date: formatDate(a.publishedAt),
        readTime: `${a.readingTimeMinutes || 3} min read`,
        image: a.image || "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=800&q=80",
        imageAlt: a.imageAlt || a.title,
        href: `/cities/${a.citySlug}/${a.slug}`,
      }))
    : DEFAULT_LATEST_NEWS;

  const editorPick = editorsPicks[0] || articles[5] || {
    title: "PortAventura World Announces Major Expansion for 2026",
    excerpt:
      "PortAventura World reveals details of its biggest expansion in more than a decade, including a new roller coaster and themed land.",
    categoryName: "THEME PARKS",
    publishedAt: "2025-05-12T00:00:00Z",
    readingTimeMinutes: 5,
    image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "PortAventura World Expansion View",
    href: "/categories/theme-parks",
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd()) }}
      />

      <div className="bg-white text-[#0B1527]">
        {/* =========================================
            1. HERO "TOP STORY" SECTION
        ========================================= */}
        <section className="w-full bg-white border-b border-slate-100">
          <HomeHeroCarousel slides={dynamicHeroSlides} />
        </section>

        {/* =========================================
            2. LATEST NEWS SECTION (4 CARDS)
        ========================================= */}
        <section className="py-10 sm:py-14 border-b border-slate-100">
          <Container>
            <div className="flex items-center justify-between mb-6 pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <span className="w-1 h-5 bg-[#DC2626] rounded-full inline-block" />
                <h2 className="text-lg sm:text-xl font-black uppercase tracking-tight text-[#0B1527]">
                  LATEST NEWS
                </h2>
              </div>
              <Link
                href="/latest-news"
                className="text-xs font-bold uppercase tracking-wider text-slate-700 hover:text-[#DC2626] flex items-center gap-1 transition-colors"
              >
                <span>VIEW ALL NEWS</span>
                <span aria-hidden="true">→</span>
              </Link>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {latestNewsList.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="group flex flex-col rounded-xl overflow-hidden bg-white border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-300"
                >
                  <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-100">
                    <Image
                      src={item.image}
                      alt={item.imageAlt}
                      fill
                      sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="p-4 flex flex-col flex-1 justify-between">
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#DC2626]">
                        {item.tag}
                      </span>
                      <h3 className="mt-1 font-sans text-sm sm:text-base font-bold leading-snug text-[#0B1527] group-hover:text-[#DC2626] transition-colors line-clamp-2">
                        {item.title}
                      </h3>
                    </div>
                    <div className="mt-3 text-[11px] text-slate-500 font-medium">
                      {item.date} • {item.readTime}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </Container>
        </section>

        {/* =========================================
            3. POPULAR DESTINATIONS & TOP ATTRACTIONS
        ========================================= */}
        <section className="py-10 sm:py-14 border-b border-slate-100">
          <Container>
            <div className="grid gap-10 lg:grid-cols-12">
              {/* Left (58%): Popular Destinations */}
              <div className="lg:col-span-7">
                <div className="flex items-center justify-between mb-6 pb-2 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="w-1 h-5 bg-[#DC2626] rounded-full inline-block" />
                    <h2 className="text-lg sm:text-xl font-black uppercase tracking-tight text-[#0B1527]">
                      POPULAR DESTINATIONS
                    </h2>
                  </div>
                  <Link
                    href="/cities"
                    className="text-xs font-bold uppercase tracking-wider text-slate-700 hover:text-[#DC2626] flex items-center gap-1 transition-colors"
                  >
                    <span>VIEW ALL</span>
                    <span aria-hidden="true">→</span>
                  </Link>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {POPULAR_DESTINATIONS.map((dest) => (
                    <Link
                      key={dest.slug}
                      href={`/cities/${dest.slug}`}
                      className="group relative aspect-[4/3] rounded-xl overflow-hidden shadow-sm hover:shadow-md cursor-pointer bg-slate-900"
                    >
                      <Image
                        src={dest.image}
                        alt={dest.alt}
                        fill
                        sizes="(min-width: 1024px) 20vw, 33vw"
                        className="object-cover opacity-85 transition-transform duration-500 group-hover:scale-110 group-hover:opacity-95"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                      <div className="absolute inset-0 flex items-center justify-center p-2 text-center">
                        <span className="font-sans text-base sm:text-lg font-black tracking-wide text-white drop-shadow-md">
                          {dest.name}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Right (42%): Top Attractions */}
              <div className="lg:col-span-5">
                <div className="flex items-center justify-between mb-6 pb-2 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="w-1 h-5 bg-[#DC2626] rounded-full inline-block" />
                    <h2 className="text-lg sm:text-xl font-black uppercase tracking-tight text-[#0B1527]">
                      TOP ATTRACTIONS
                    </h2>
                  </div>
                  <Link
                    href="/cities"
                    className="text-xs font-bold uppercase tracking-wider text-slate-700 hover:text-[#DC2626] flex items-center gap-1 transition-colors"
                  >
                    <span>VIEW ALL</span>
                    <span aria-hidden="true">→</span>
                  </Link>
                </div>

                <div className="space-y-3.5">
                  {TOP_ATTRACTIONS.map((attr) => (
                    <Link
                      key={attr.rank}
                      href={attr.href}
                      className="group flex items-center gap-3.5 p-2 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all"
                    >
                      {/* Rank Number Circle */}
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0B1527] text-white text-xs font-bold shadow-sm">
                        {attr.rank}
                      </div>

                      {/* Thumbnail Image */}
                      <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-200">
                        <Image
                          src={attr.image}
                          alt={attr.title}
                          fill
                          sizes="80px"
                          className="object-cover group-hover:scale-105 transition-transform"
                        />
                      </div>

                      {/* Content & Badge */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-sans text-xs sm:text-sm font-bold text-[#0B1527] group-hover:text-[#DC2626] transition-colors truncate">
                          {attr.title}
                        </h3>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          {attr.subtitle}
                        </p>
                        <div className="mt-1">
                          <span className="inline-block rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-600">
                            {attr.location}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </Container>
        </section>

        {/* =========================================
            4. EDITOR'S PICK & STAY IN THE LOOP
        ========================================= */}
        <section className="py-10 sm:py-14 border-b border-slate-100 bg-white">
          <Container>
            <div className="grid gap-10 lg:grid-cols-12">
              {/* Left (65%): Editor's Pick */}
              <div className="lg:col-span-8">
                <div className="flex items-center gap-2 mb-6 pb-2 border-b border-slate-200">
                  <span className="w-1 h-5 bg-[#DC2626] rounded-full inline-block" />
                  <h2 className="text-lg sm:text-xl font-black uppercase tracking-tight text-[#0B1527]">
                    EDITOR&apos;S PICK
                  </h2>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm grid md:grid-cols-12 gap-6 items-center">
                  <div className="md:col-span-6 relative aspect-[16/11] w-full overflow-hidden rounded-xl bg-slate-100">
                    <Image
                      src={editorPick.image || "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80"}
                      alt={editorPick.imageAlt || editorPick.title}
                      fill
                      sizes="(min-width: 1024px) 35vw, 100vw"
                      className="object-cover"
                    />
                  </div>

                  <div className="md:col-span-6 flex flex-col justify-between">
                    <div>
                      <span className="text-xs font-extrabold uppercase tracking-wider text-[#DC2626]">
                        {editorPick.categoryName || "THEME PARKS"}
                      </span>
                      <h3 className="mt-1 font-sans text-xl sm:text-2xl font-black leading-tight text-[#0B1527]">
                        {editorPick.title}
                      </h3>
                      <p className="mt-3 text-xs sm:text-sm text-slate-600 leading-relaxed line-clamp-3">
                        {editorPick.excerpt}
                      </p>
                      <p className="mt-3 text-[11px] text-slate-500 font-medium">
                        {formatDate(editorPick.publishedAt)} • {editorPick.readingTimeMinutes || 5} min read
                      </p>
                    </div>

                    <div className="mt-5">
                      <Link
                        href={editorPick.slug ? `/cities/${editorPick.citySlug || "paris"}/${editorPick.slug}` : "/categories/theme-parks"}
                        className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-extrabold uppercase tracking-wider text-[#0B1527] hover:border-[#0B1527] hover:bg-slate-50 transition-all"
                      >
                        <span>READ MORE</span>
                        <span aria-hidden="true">→</span>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right (35%): Stay in the Loop & Follow Us */}
              <div className="lg:col-span-4">
                <div className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-6 sm:p-7 shadow-sm">
                  <h3 className="font-sans text-base font-black uppercase tracking-tight text-[#0B1527]">
                    STAY IN THE LOOP
                  </h3>
                  <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                    Get the latest attraction news, opening dates, and updates straight to your inbox.
                  </p>

                  <form className="mt-4 flex flex-col gap-2.5">
                    <input
                      type="email"
                      required
                      placeholder="Enter your email address"
                      className="w-full rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#DC2626] focus:outline-none focus:ring-1 focus:ring-[#DC2626]"
                    />
                    <button
                      type="submit"
                      className="w-full rounded-md bg-[#DC2626] py-2.5 text-xs font-black uppercase tracking-wider text-white shadow hover:bg-[#B91C1C] transition-colors"
                    >
                      SUBSCRIBE
                    </button>
                  </form>
                  <p className="mt-2 text-[10px] text-slate-500 text-center">
                    No spam. Unsubscribe anytime.
                  </p>

                  {/* Follow Us Social Icons */}
                  <div className="mt-7 pt-5 border-t border-slate-200">
                    <h4 className="font-sans text-xs font-extrabold uppercase tracking-wider text-[#0B1527] mb-3">
                      FOLLOW US
                    </h4>
                    <div className="flex items-center gap-2">
                      {/* Facebook */}
                      <a
                        href="https://facebook.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex h-8 w-8 items-center justify-center rounded bg-[#1877F2] text-white hover:opacity-90 shadow-sm transition-opacity"
                        aria-label="Facebook"
                      >
                        <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                          <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
                        </svg>
                      </a>
                      {/* X / Twitter */}
                      <a
                        href="https://x.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex h-8 w-8 items-center justify-center rounded bg-black text-white hover:opacity-90 shadow-sm transition-opacity"
                        aria-label="X"
                      >
                        <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                        </svg>
                      </a>
                      {/* Instagram */}
                      <a
                        href="https://instagram.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex h-8 w-8 items-center justify-center rounded bg-gradient-to-tr from-amber-500 via-pink-500 to-purple-600 text-white hover:opacity-90 shadow-sm transition-opacity"
                        aria-label="Instagram"
                      >
                        <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                        </svg>
                      </a>
                      {/* YouTube */}
                      <a
                        href="https://youtube.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex h-8 w-8 items-center justify-center rounded bg-[#FF0000] text-white hover:opacity-90 shadow-sm transition-opacity"
                        aria-label="YouTube"
                      >
                        <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                        </svg>
                      </a>
                      {/* TikTok */}
                      <a
                        href="https://tiktok.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex h-8 w-8 items-center justify-center rounded bg-black text-white hover:opacity-90 shadow-sm transition-opacity"
                        aria-label="TikTok"
                      >
                        <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                          <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.59-1v5.19c.02 3.52-2.45 6.74-5.91 7.42-3.46.68-7.05-1.2-8.39-4.41-1.34-3.21.14-6.99 3.32-8.49.88-.42 1.85-.64 2.82-.67v4.12c-.59.04-1.18.23-1.68.56-1.11.75-1.61 2.17-1.21 3.44.4 1.28 1.65 2.13 2.99 2.05 1.34-.08 2.45-1.07 2.65-2.4.05-.33.06-.67.06-1V.02z" />
                        </svg>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Container>
        </section>

        {/* =========================================
            5. TRENDING TOPICS SECTION
        ========================================= */}
        <section className="py-10 sm:py-14 bg-white">
          <Container>
            <h2 className="font-sans text-xs sm:text-sm font-black uppercase tracking-wider text-[#0B1527] mb-4">
              TRENDING TOPICS
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              {TRENDING_TOPICS.map((topic) => (
                <Link
                  key={topic.name}
                  href={topic.href}
                  className="rounded-full border border-slate-200 bg-white hover:border-[#0B1527] hover:bg-slate-50 px-5 py-2 text-xs font-extrabold text-[#0B1527] shadow-sm transition-all hover:shadow"
                >
                  {topic.name}
                </Link>
              ))}
            </div>
          </Container>
        </section>
      </div>
    </>
  );
}
