import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import Container from "@/components/Container";
import EmptyState from "@/components/EmptyState";
import NumberedPagination from "@/components/NumberedPagination";
import { getPublishedNews, getStoryCountsByCategory, getTrendingStories } from "@/lib/articles";
import { getCategories } from "@/lib/categories";
import { buildMetadata, breadcrumbJsonLd, jsonLdScript } from "@/lib/seo";
import { storyHref, storyDate, readTime, storyLabel, newsPaging } from "@/lib/home";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    title: "Travel News: Flights, Destinations, Attractions & Rules",
    description: "Verified updates on flights, destinations, attractions and travel rules, written for people who plan trips.",
    path: "/news",
  });
}

// Links to official sites travellers check before a trip.
const OFFICIAL_RESOURCES = [
  { name: "IATA – Travel Information", href: "https://www.iata.org" },
  { name: "U.S. State Department", href: "https://travel.state.gov" },
  { name: "European Travel Information", href: "https://travel-europe.europa.eu" },
  { name: "World Health Organization", href: "https://www.who.int" },
];

export default async function NewsIndexPage({ searchParams }: { searchParams: { category?: string; page?: string } }) {
  const [categories, newsCounts] = await Promise.all([
    getCategories().catch(() => []),
    getStoryCountsByCategory("news").catch(() => ({} as Record<string, number>)),
  ]);
  // Filter pills: categories that have at least one published news story.
  const filters = categories.filter((c) => (newsCounts[c.id] || 0) > 0);
  const active = categories.find((c) => c.slug === searchParams.category);
  const categorySlug = active?.slug || "";

  const page = Math.max(1, Math.floor(Number(searchParams.page) || 1));
  const { offset, limit } = newsPaging(page, 0);
  const [{ articles, total }, trending] = await Promise.all([
    getPublishedNews({ limit, offset, categorySlug }).catch(() => ({ articles: [], total: 0 })),
    getTrendingStories(6, "news").catch(() => []),
  ]);
  const { totalPages } = newsPaging(page, total);

  // Lead story on the first page; the rest are cards.
  const lead = page === 1 ? articles[0] : undefined;
  const cards = page === 1 ? articles.slice(1) : articles;
  // Briefing: most-read news not already on this page.
  const onPage = new Set(articles.map((a) => a.id));
  const briefings = trending.filter((a) => !onPage.has(a.id)).slice(0, 3);

  return (
    <div className="bg-white min-h-screen text-ink-900 pb-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Travel News", path: "/news" }])),
        }}
      />

      <Container className="pt-6 sm:pt-8">
        {/* =========================================
            1. PAGE HEADER
        ========================================= */}
        <header className="pb-5">
          <p className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-signal">
            WORLD ATTRACTION NEWS
          </p>
          <h1 className="mt-1 font-serif text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-ink-900">
            Travel News
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-gray-600 font-normal">
            Verified updates on flights, destinations, attractions and travel rules.
          </p>
        </header>

        {/* =========================================
            2. CATEGORY FILTER PILLS
        ========================================= */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-2 border-b border-gray-100">
          {[{ name: "All News", slug: "" }, ...filters].map((cat) => {
            const isActive = cat.slug === categorySlug;
            return (
              <Link
                key={cat.slug || "all"}
                href={cat.slug ? `/news?category=${encodeURIComponent(cat.slug)}` : "/news"}
                aria-current={isActive ? "page" : undefined}
                className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-[#0e182f] text-white shadow-2xs"
                    : "bg-white border border-gray-200 text-gray-700 hover:border-gray-400 hover:text-ink-950"
                }`}
              >
                {cat.name}
              </Link>
            );
          })}
        </div>

        {/* =========================================
            3. FEATURED LEAD STORY SPLIT CARD
        ========================================= */}
        {articles.length === 0 && (
          <div className="my-10">
            <EmptyState
              title={active ? `No ${active.name} news yet` : "No news published yet"}
              description="Check back soon for verified updates on flights, destinations and travel rules."
            />
          </div>
        )}

        {lead && (
        <div className="my-7 rounded-2xl border border-gray-100 bg-white overflow-hidden shadow-2xs hover:shadow-md transition-shadow grid grid-cols-1 md:grid-cols-12">
          {/* Left: Image (7 cols) */}
          <Link
            href={storyHref(lead)}
            className="md:col-span-7 relative min-h-[260px] sm:min-h-[320px] md:min-h-[380px] bg-gray-100 group overflow-hidden"
          >
            {lead.image && (
            <Image
              src={lead.image}
              alt={lead.imageAlt || lead.title}
              fill
              priority
              sizes="(min-width: 1024px) 58vw, 100vw"
              className="object-cover object-center transition-transform duration-500 group-hover:scale-102"
            />
            )}
          </Link>

          {/* Right: Content (5 cols) */}
          <div className="md:col-span-5 p-6 sm:p-8 lg:p-10 flex flex-col justify-between">
            <div>
              {/* Category tag */}
              <div>
                <span className="inline-block rounded-full bg-rose-50 px-3 py-1 text-[10.5px] font-bold uppercase tracking-wider text-signal">
                  {storyLabel(lead)}
                </span>
              </div>

              {/* Meta */}
              <p className="mt-3 text-xs text-gray-500 font-normal">
                {[storyDate(lead.publishedAt), readTime(lead)].filter(Boolean).join(" • ")}
              </p>

              {/* Title */}
              <h2 className="mt-3 font-serif text-2xl sm:text-3xl font-bold leading-snug text-ink-900 hover:text-signal transition-colors">
                <Link href={storyHref(lead)}>{lead.title}</Link>
              </h2>

              {/* Excerpt */}
              <p className="mt-3.5 text-xs sm:text-sm leading-relaxed text-gray-500 line-clamp-4">
                {lead.excerpt}
              </p>
            </div>

            {/* Read full story button */}
            <div className="mt-6">
              <Link
                href={storyHref(lead)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0e182f] px-5 py-2.5 text-xs font-semibold text-white shadow-2xs transition-colors hover:bg-ink-950"
              >
                <span>Read full story</span>
                <span aria-hidden="true" className="font-bold">→</span>
              </Link>
            </div>
          </div>
        </div>
        )}

        {/* =========================================
            4. 2-COLUMN MAIN CONTENT
        ========================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 pt-4 items-start">
          {/* =========================================
              LEFT COLUMN: LATEST TRAVEL NEWS (8 COLS)
          ========================================= */}
          <div className="lg:col-span-8">
            {cards.length > 0 && (
            <>
            {/* Header with extending line */}
            <div className="flex items-center gap-4 pb-2">
              <h2 className="font-serif text-2xl font-bold text-ink-900 tracking-tight shrink-0">
                Latest Travel News
              </h2>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* 3-Card Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mt-6">
              {cards.map((item) => (
                <article key={item.id} className="group flex flex-col justify-between">
                  <div>
                    {/* Image */}
                    <Link
                      href={storyHref(item)}
                      className="relative block aspect-[16/10] w-full overflow-hidden rounded-xl bg-gray-100 shadow-2xs"
                    >
                      {item.image && (
                      <Image
                        src={item.image}
                        alt={item.imageAlt || item.title}
                        fill
                        sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 100vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      )}
                    </Link>

                    {/* Category */}
                    <div className="mt-3.5">
                      <span className="text-[10.5px] font-bold uppercase tracking-wider text-signal">
                        {storyLabel(item)}
                      </span>
                    </div>

                    {/* Meta */}
                    <p className="mt-1 text-[11px] text-gray-500 font-normal">
                      {[storyDate(item.publishedAt), readTime(item)].filter(Boolean).join(" • ")}
                    </p>

                    {/* Title */}
                    <h3 className="mt-1.5 font-serif text-[16px] font-bold leading-snug text-ink-900 group-hover:text-signal transition-colors line-clamp-3">
                      <Link href={storyHref(item)}>{item.title}</Link>
                    </h3>

                    {/* Excerpt */}
                    <p className="mt-2 text-xs leading-relaxed text-gray-500 line-clamp-3">
                      {item.excerpt}
                    </p>
                  </div>
                </article>
              ))}
            </div>
            </>
            )}

            <div className="mt-10">
              <NumberedPagination page={page} totalPages={totalPages} basePath="/news" searchParams={{ category: categorySlug || undefined }} />
            </div>
          </div>

          {/* =========================================
              RIGHT COLUMN: SIDEBAR (4 COLS)
          ========================================= */}
          <aside className="lg:col-span-4 space-y-8">
            {/* -----------------------------------------
                WIDGET 1: TRAVEL BRIEFING (most-read news not on this page)
            ----------------------------------------- */}
            {briefings.length > 0 && (
            <div>
              <div className="flex items-center gap-4 pb-2 border-b border-gray-200">
                <h3 className="font-serif text-lg font-bold text-ink-900 tracking-tight shrink-0">
                  Travel Briefing
                </h3>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              <div className="mt-4 space-y-4">
                {briefings.map((item, idx) => (
                  <div key={item.id} className={idx > 0 ? "pt-3 border-t border-gray-100" : ""}>
                    <p className="text-[11px] text-gray-500 font-normal mb-1">
                      {[storyDate(item.publishedAt), readTime(item)].filter(Boolean).join(" • ")}
                    </p>
                    <Link
                      href={storyHref(item)}
                      className="font-sans text-xs sm:text-sm font-bold leading-snug text-ink-900 hover:text-signal transition-colors line-clamp-2"
                    >
                      {item.title}
                    </Link>
                  </div>
                ))}
              </div>
            </div>
            )}

            {/* -----------------------------------------
                WIDGET 2: OFFICIAL TRAVEL RESOURCES
            ----------------------------------------- */}
            <div>
              <div className="flex items-center gap-4 pb-2 border-b border-gray-200">
                <h3 className="font-serif text-lg font-bold text-ink-900 tracking-tight shrink-0">
                  Official travel resources
                </h3>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              <ul className="mt-3 divide-y divide-gray-100">
                {OFFICIAL_RESOURCES.map((r) => (
                  <li key={r.name}>
                    <a
                      href={r.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between py-2.5 text-xs font-semibold text-gray-700 hover:text-signal transition-colors group"
                    >
                      <span>{r.name}</span>
                      <svg
                        className="h-3.5 w-3.5 text-gray-400 group-hover:text-signal transition-colors shrink-0 ml-2"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </Container>
    </div>
  );
}
