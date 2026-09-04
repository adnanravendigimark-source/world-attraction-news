import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import Container from "@/components/Container";
import HomeHeroCarousel from "@/components/HomeHeroCarousel";
import NewsletterForm from "@/components/NewsletterForm";
import EmptyState from "@/components/EmptyState";
import { getCitiesWithArticleCounts } from "@/lib/cities";
import { getCategories } from "@/lib/categories";
import {
  getPublishedArticles,
  getTrendingArticles,
  getFeaturedArticles,
  getEditorsPickArticles,
  getBreakingArticles,
  getTopScoredArticles,
} from "@/lib/articles";
import { buildMetadata, websiteJsonLd } from "@/lib/seo";
import { getSettings } from "@/lib/settings";
import { SITE_NAME, SITE_DESCRIPTION, SITE_TAGLINE } from "@/lib/site";

// Pure read (no per-request writes, no searchParams) — real ISR instead of
// force-dynamic. 60s is a real cache window, not a fake one: repeat
// homepage visits within that window are served from the cache (fast, no DB
// round trip), and it's short enough that a newly published/featured
// article shows up within a minute on its own. Admin actions that should
// feel instant (publish, feature/unfeature, unpublish) additionally call
// revalidatePath("/") so this page updates immediately rather than waiting
// out the window — see the admin article/city/category routes.
export const revalidate = 60;

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

// No hardcoded fallback date — an empty string here means the caller omits
// the date entirely rather than showing a fake one.
function formatDate(iso: string | null) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "";
  }
}

function dateAndReadTime(date: string, readTime: string) {
  return [date, readTime].filter(Boolean).join(" • ");
}

const SOCIAL_LINKS = [
  {
    name: "Facebook",
    href: "https://facebook.com",
    bg: "bg-[#1877F2]",
    path: "M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z",
  },
  {
    name: "X",
    href: "https://x.com",
    bg: "bg-black",
    path: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z",
  },
  {
    name: "Instagram",
    href: "https://instagram.com",
    bg: "bg-gradient-to-tr from-amber-500 via-pink-500 to-purple-600",
    path: "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z",
  },
  {
    name: "YouTube",
    href: "https://youtube.com",
    bg: "bg-[#FF0000]",
    path: "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z",
  },
];

export default async function HomePage() {
  const [cities, categories, articles, trending, featured, editorsPicks, breaking, topScored] = await Promise.all([
    getCitiesWithArticleCounts(),
    getCategories(),
    getPublishedArticles({ limit: 20 }),
    getTrendingArticles(6),
    getFeaturedArticles(6),
    getEditorsPickArticles(4),
    getBreakingArticles(6),
    getTopScoredArticles(5),
  ]);

  // Hero source, in order of editorial intent: admin-curated "Featured"
  // articles first (that's exactly what the flag is for), then algorithmic
  // Trending (real 30-day view/score activity), then just the most recent
  // published articles. Whatever's actually available — never padded with
  // invented stories.
  const heroSourceArticles = (featured.length ? featured : trending.length ? trending : articles).slice(0, 5);
  const dynamicHeroSlides = heroSourceArticles.map((a) => ({
    id: a.id,
    eyebrow: a.cityName ? `${a.cityName.toUpperCase()} BUREAU` : "TOP STORY",
    cityName: a.cityName ? a.cityName.toUpperCase() : "GLOBAL",
    categoryName: a.categoryName ? a.categoryName.toUpperCase() : "ATTRACTION NEWS",
    title: a.title,
    excerpt: a.excerpt,
    author: a.authorName || "Attraction News Team",
    date: formatDate(a.publishedAt),
    readTime: `${a.readingTimeMinutes || 4} min read`,
    image: a.image || "/images/epic-universe.jpg",
    imageAlt: a.imageAlt || a.title,
    href: `/cities/${a.citySlug}/${a.slug}`,
  }));

  // Ticker: real breaking-news flags first, falling back to trending.
  const tickerSource = breaking.length ? breaking : trending;
  const tickerItems = tickerSource.slice(0, 6).map((a) => ({
    label: a.title,
    href: `/cities/${a.citySlug}/${a.slug}`,
  }));

  const latestNews = articles.slice(0, 4);

  // Real per-city popularity ranking (published article count) — no
  // hardcoded destination list. A city without its own hero image is
  // skipped here rather than shown with a generic stand-in photo, since a
  // substituted photo would misrepresent that specific destination.
  const popularDestinations = cities.filter((c) => c.heroImage).slice(0, 6);

  // Highest-scored published articles, real reader-favorites signal.
  // Attractions are surfaced through the articles written about them since
  // attractions themselves don't carry a score.
  const topAttractions = topScored.map((a, i) => ({
    rank: i + 1,
    title: a.attractionName || a.title,
    subtitle: a.attractionName ? a.cityName : a.categoryName || a.cityName,
    location: a.cityName?.toUpperCase() || "",
    image: a.image,
    imageAlt: a.imageAlt || a.title,
    href: a.attractionSlug
      ? `/cities/${a.citySlug}/attractions/${a.attractionSlug}`
      : `/cities/${a.citySlug}/${a.slug}`,
  }));

  const heroUsedIds = new Set(heroSourceArticles.map((a) => a.id));
  const editorPick = editorsPicks[0] || articles.find((a) => !heroUsedIds.has(a.id)) || articles[0];

  const hasDestinations = popularDestinations.length > 0;
  const hasTopAttractions = topAttractions.length > 0;

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
          <HomeHeroCarousel slides={dynamicHeroSlides} tickerItems={tickerItems} />
        </section>

        {/* =========================================
            2. LATEST NEWS SECTION (up to 4 real cards)
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

            {latestNews.length === 0 ? (
              <EmptyState title="No news published yet" description="Check back soon for the latest attraction updates." />
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {latestNews.map((a) => {
                  const date = formatDate(a.publishedAt);
                  const readTime = `${a.readingTimeMinutes || 3} min read`;
                  return (
                    <Link
                      key={a.id}
                      href={`/cities/${a.citySlug}/${a.slug}`}
                      className="group flex flex-col rounded-xl overflow-hidden bg-white border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-300"
                    >
                      <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-100">
                        <Image
                          src={a.image || "/images/epic-universe.jpg"}
                          alt={a.imageAlt || a.title}
                          fill
                          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      </div>
                      <div className="p-4 flex flex-col flex-1 justify-between">
                        <div>
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#DC2626]">
                            {a.categoryName?.toUpperCase() || a.cityName?.toUpperCase() || "NEWS"}
                          </span>
                          <h3 className="mt-1 font-sans text-sm sm:text-base font-bold leading-snug text-[#0B1527] group-hover:text-[#DC2626] transition-colors line-clamp-2">
                            {a.title}
                          </h3>
                        </div>
                        <div className="mt-3 text-[11px] text-slate-500 font-medium">
                          {dateAndReadTime(date, readTime)}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </Container>
        </section>

        {/* =========================================
            3. POPULAR DESTINATIONS & TOP ATTRACTIONS
        ========================================= */}
        {(hasDestinations || hasTopAttractions) && (
          <section className="py-10 sm:py-14 border-b border-slate-100">
            <Container>
              <div className="grid gap-10 lg:grid-cols-12">
                {hasDestinations && (
                  <div className={hasTopAttractions ? "lg:col-span-7" : "lg:col-span-12"}>
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
                      {popularDestinations.map((dest) => (
                        <Link
                          key={dest.slug}
                          href={`/cities/${dest.slug}`}
                          className="group relative aspect-[4/3] rounded-xl overflow-hidden shadow-sm hover:shadow-md cursor-pointer bg-slate-900"
                        >
                          <Image
                            src={dest.heroImage}
                            alt={dest.heroImageAlt || dest.name}
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
                )}

                {hasTopAttractions && (
                  <div className={hasDestinations ? "lg:col-span-5" : "lg:col-span-12"}>
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
                      {topAttractions.map((attr) => (
                        <Link
                          key={attr.rank}
                          href={attr.href}
                          className="group flex items-center gap-3.5 p-2 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all"
                        >
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0B1527] text-white text-xs font-bold shadow-sm">
                            {attr.rank}
                          </div>

                          <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-200">
                            <Image
                              src={attr.image || "/images/epic-universe.jpg"}
                              alt={attr.imageAlt}
                              fill
                              sizes="80px"
                              className="object-cover group-hover:scale-105 transition-transform"
                            />
                          </div>

                          <div className="flex-1 min-w-0">
                            <h3 className="font-sans text-xs sm:text-sm font-bold text-[#0B1527] group-hover:text-[#DC2626] transition-colors truncate">
                              {attr.title}
                            </h3>
                            {attr.subtitle && (
                              <p className="text-[11px] text-slate-500 truncate mt-0.5">{attr.subtitle}</p>
                            )}
                            {attr.location && (
                              <div className="mt-1">
                                <span className="inline-block rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-600">
                                  {attr.location}
                                </span>
                              </div>
                            )}
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Container>
          </section>
        )}

        {/* =========================================
            4. EDITOR'S PICK & STAY IN THE LOOP
        ========================================= */}
        <section className="py-10 sm:py-14 border-b border-slate-100 bg-white">
          <Container>
            <div className="grid gap-10 lg:grid-cols-12">
              {editorPick && (
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
                        src={editorPick.image || "/images/epic-universe.jpg"}
                        alt={editorPick.imageAlt || editorPick.title}
                        fill
                        sizes="(min-width: 1024px) 35vw, 100vw"
                        className="object-cover"
                      />
                    </div>

                    <div className="md:col-span-6 flex flex-col justify-between">
                      <div>
                        <span className="text-xs font-extrabold uppercase tracking-wider text-[#DC2626]">
                          {editorPick.categoryName?.toUpperCase() || "ATTRACTION NEWS"}
                        </span>
                        <h3 className="mt-1 font-sans text-xl sm:text-2xl font-black leading-tight text-[#0B1527]">
                          {editorPick.title}
                        </h3>
                        <p className="mt-3 text-xs sm:text-sm text-slate-600 leading-relaxed line-clamp-3">
                          {editorPick.excerpt}
                        </p>
                        <p className="mt-3 text-[11px] text-slate-500 font-medium">
                          {dateAndReadTime(formatDate(editorPick.publishedAt), `${editorPick.readingTimeMinutes || 5} min read`)}
                        </p>
                      </div>

                      <div className="mt-5">
                        <Link
                          href={`/cities/${editorPick.citySlug}/${editorPick.slug}`}
                          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-extrabold uppercase tracking-wider text-[#0B1527] hover:border-[#0B1527] hover:bg-slate-50 transition-all"
                        >
                          <span>READ MORE</span>
                          <span aria-hidden="true">→</span>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Stay in the Loop & Follow Us */}
              <div className={editorPick ? "lg:col-span-4" : "lg:col-span-6 lg:col-start-4"}>
                <div className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-6 sm:p-7 shadow-sm">
                  <h3 className="font-sans text-base font-black uppercase tracking-tight text-[#0B1527]">
                    STAY IN THE LOOP
                  </h3>
                  <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                    Get the latest attraction news, opening dates, and updates straight to your inbox.
                  </p>

                  <div className="mt-4">
                    <NewsletterForm source="homepage" variant="light" />
                  </div>
                  <p className="mt-2 text-[10px] text-slate-500 text-center">
                    No spam. Unsubscribe anytime.
                  </p>

                  <div className="mt-7 pt-5 border-t border-slate-200">
                    <h4 className="font-sans text-xs font-extrabold uppercase tracking-wider text-[#0B1527] mb-3">
                      FOLLOW US
                    </h4>
                    <div className="flex items-center gap-2">
                      {SOCIAL_LINKS.map((social) => (
                        <a
                          key={social.name}
                          href={social.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`flex h-8 w-8 items-center justify-center rounded ${social.bg} text-white hover:opacity-90 shadow-sm transition-opacity`}
                          aria-label={social.name}
                        >
                          <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                            <path d={social.path} />
                          </svg>
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Container>
        </section>

        {/* =========================================
            5. BROWSE BY TOPIC (real categories)
        ========================================= */}
        {categories.length > 0 && (
          <section className="py-10 sm:py-14 bg-white">
            <Container>
              <h2 className="font-sans text-xs sm:text-sm font-black uppercase tracking-wider text-[#0B1527] mb-4">
                BROWSE BY TOPIC
              </h2>
              <div className="flex flex-wrap items-center gap-3">
                {categories.map((cat) => (
                  <Link
                    key={cat.id}
                    href={`/categories/${cat.slug}`}
                    className="rounded-full border border-slate-200 bg-white hover:border-[#0B1527] hover:bg-slate-50 px-5 py-2 text-xs font-extrabold text-[#0B1527] shadow-sm transition-all hover:shadow"
                  >
                    {cat.name}
                  </Link>
                ))}
              </div>
            </Container>
          </section>
        )}
      </div>
    </>
  );
}
