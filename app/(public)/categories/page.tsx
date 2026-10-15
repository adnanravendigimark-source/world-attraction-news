import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import Container from "@/components/Container";
import NewsletterForm from "@/components/NewsletterForm";
import CategoryIcon from "@/components/CategoryIcon";
import { getCategories } from "@/lib/categories";
import { getStoryCountsByCategory, getLatestPublishedArticleImageByCategory } from "@/lib/articles";
import { popularCategories } from "@/lib/home";
import { buildMetadata, breadcrumbJsonLd, itemListJsonLd, jsonLdScript } from "@/lib/seo";

export const revalidate = 300;

// Every category, its published story count (news and guides) and the
// newest story image, for cards whose category has no image set in Admin.
const getCategoriesPageData = unstable_cache(
  async () => {
    const [categories, counts, latestImages] = await Promise.all([
      getCategories().catch(() => []),
      getStoryCountsByCategory().catch(() => ({} as Record<string, number>)),
      getLatestPublishedArticleImageByCategory().catch(() => ({} as Record<string, string>)),
    ]);
    return { categories, counts, latestImages };
  },
  ["categories-page-data-v2"],
  { revalidate: 300, tags: ["categories", "articles"] }
);

export const metadata: Metadata = buildMetadata({
  title: "Travel News Categories",
  description:
    "Browse travel news and guides by category: airports, travel rules, destinations, attractions, travel tips and more.",
  path: "/categories",
});

export default async function CategoriesPage() {
  const { categories, counts, latestImages } = await getCategoriesPageData();

  const displayCards = categories.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    description: c.description,
    image: c.image || latestImages[c.id] || "",
    imageAlt: c.imageAlt || c.name,
    href: `/categories/${c.slug}`,
    articleCount: counts[c.id] || 0,
  }));
  const popular = popularCategories(categories, counts, 6)
    .filter((c) => (counts[c.id] || 0) > 0)
    .map((c) => displayCards.find((d) => d.id === c.id)!);

  const breadcrumbs = [
    { name: "Home", path: "/" },
    { name: "Categories", path: "/categories" },
  ];

  return (
    <div className="bg-white min-h-screen text-ink-900">
      {/* =========================================
          1. HERO HEADER: SANTORINI PANORAMA
      ========================================= */}
      <section className="relative w-full overflow-hidden border-b border-gray-100 bg-[#f9fafb]">
        {/* Right Background Image */}
        <div className="absolute right-0 top-0 bottom-0 w-full md:w-3/5 lg:w-1/2">
          <Image
            src="/images/destinations/santorini.jpg"
            alt="Santorini cliffside village overlooking the caldera"
            fill
            priority
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover object-right"
          />
        </div>

        {/* Gradient Overlay: White solid on the left, fading to transparent on the right */}
        <div className="absolute inset-0 bg-gradient-to-r from-white via-white/95 via-50% to-transparent pointer-events-none" />

        {/* Content */}
        <Container className="relative z-10 pt-6 pb-12 sm:pt-8 sm:pb-16">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-xs text-gray-500 font-medium mb-4 sm:mb-6">
            <Link href="/" className="hover:text-ink-900 transition-colors">
              Home
            </Link>
            <span className="text-gray-400">&gt;</span>
            <span className="text-ink-900 font-semibold">Categories</span>
          </nav>

          <div className="max-w-xl">
            {/* Tag */}
            <div className="flex items-center gap-1.5 mb-2.5">
              <span className="h-2 w-2 rounded-full bg-signal" />
              <span className="text-[11px] font-black uppercase tracking-widest text-signal">
                CATEGORIES
              </span>
            </div>

            {/* Title */}
            <h1 className="font-serif text-3xl sm:text-4xl lg:text-[46px] font-black tracking-tight text-ink-900 leading-[1.12]">
              Browse by Category
            </h1>

            {/* Subtitle */}
            <p className="mt-3 sm:mt-4 text-xs sm:text-sm md:text-[15px] leading-relaxed text-gray-600 font-normal">
              Find travel news and guides by topic, from airport and travel rule updates to destinations, attractions and practical travel tips.
            </p>
          </div>
        </Container>
      </section>

      {/* =========================================
          2. MAIN CONTENT: 2-COLUMN LAYOUT
      ========================================= */}
      <section className="w-full py-8 sm:py-10 pb-16">
        <Container>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
            {/* =========================================
                LEFT COLUMN: CATEGORY CARDS FROM THE DATABASE (8 COLS)
            ========================================= */}
            <div className="lg:col-span-8">
              {/* Section Heading */}
              <div className="flex items-center mb-6">
                <span className="h-5 w-1 bg-signal rounded-full mr-2.5 inline-block" />
                <h2 className="font-serif text-2xl font-bold text-ink-900 tracking-tight">
                  All Categories
                </h2>
              </div>

              {displayCards.length === 0 && (
                <p className="text-sm text-gray-500">No categories yet.</p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                {displayCards.map((cat) => (
                  <Link
                    key={cat.id}
                    href={cat.href}
                    className="group flex flex-col rounded-2xl bg-white border border-gray-100 shadow-2xs hover:shadow-md transition-all duration-300 overflow-hidden hover:-translate-y-0.5"
                  >
                    {/* Top Image Container */}
                    <div className="relative aspect-[16/10] w-full overflow-hidden bg-gray-100">
                      {cat.image ? (
                        <Image
                          src={cat.image}
                          alt={cat.imageAlt}
                          fill
                          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-rose-50 text-signal/40">
                          <CategoryIcon slug={cat.slug} className="h-12 w-12" />
                        </div>
                      )}

                      {/* Top-left floating circular white icon badge */}
                      <div className="absolute top-3 left-3 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-md text-signal transition-transform duration-300 group-hover:scale-110">
                        <CategoryIcon slug={cat.slug} className="h-[18px] w-[18px]" />
                      </div>

                      {/* Top-right floating dark pill: article count */}
                      <div className="absolute top-3 right-3 rounded-full bg-black/65 backdrop-blur-xs px-2.5 py-0.5 text-[11px] font-semibold text-white">
                        {cat.articleCount} {cat.articleCount === 1 ? "story" : "stories"}
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="p-4 sm:p-5 flex flex-col justify-between flex-1">
                      <div>
                        {/* Category Title */}
                        <h3 className="font-sans text-base font-bold text-ink-900 group-hover:text-signal transition-colors">
                          {cat.name}
                        </h3>

                        {/* Description */}
                        {cat.description && (
                          <p className="mt-1.5 text-xs leading-relaxed text-gray-500 line-clamp-2">
                            {cat.description}
                          </p>
                        )}
                      </div>

                      {/* Bottom Right: Circular Red Action Arrow */}
                      <div className="mt-4 flex justify-end">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-50 text-signal transition-colors group-hover:bg-signal group-hover:text-white shadow-2xs">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* =========================================
                RIGHT COLUMN: SIDEBAR (4 COLS)
            ========================================= */}
            <aside className="lg:col-span-4 space-y-6">
              {/* -----------------------------------------
                  WIDGET 1: GET CATEGORY ALERTS
              ----------------------------------------- */}
              <div className="rounded-2xl border border-rose-100/70 bg-[#fffbfc] p-5 sm:p-6 shadow-2xs">
                {/* Mail Icon */}
                <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-signal">
                  <svg className="h-4.5 w-4.5 fill-none stroke-current" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>

                {/* Title & Description */}
                <h3 className="font-sans text-base font-bold text-ink-900">
                  Get Category Alerts
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-gray-500">
                  Get the latest travel news and guides straight to your inbox.
                </p>

                {/* Form */}
                <div className="mt-4">
                  <NewsletterForm source="categories-sidebar" variant="light" placeholder="Enter your email address" />
                </div>
                <p className="mt-2.5 text-[11px] text-gray-400 text-center">
                  No spam. Unsubscribe anytime.
                </p>
              </div>

              {/* -----------------------------------------
                  WIDGET 2: POPULAR CATEGORIES (most stories first)
              ----------------------------------------- */}
              {popular.length > 0 && (
              <div className="rounded-2xl border border-gray-100 bg-[#f8fafc] p-5 shadow-2xs">
                {/* Header */}
                <div className="flex items-center mb-3 pb-2 border-b border-gray-200/60">
                  <span className="h-5 w-1 bg-signal rounded-full mr-2 inline-block" />
                  <h3 className="font-serif text-lg font-bold text-ink-900 tracking-tight">
                    Popular Categories
                  </h3>
                </div>

                {/* List of categories */}
                <div className="space-y-1">
                  {popular.map((cat) => (
                    <Link
                      key={cat.id}
                      href={cat.href}
                      className="group flex items-center justify-between p-2 rounded-xl text-xs font-semibold text-gray-700 hover:text-signal hover:bg-white transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-signal transition-transform group-hover:scale-105">
                          <CategoryIcon slug={cat.slug} className="h-4 w-4" />
                        </span>
                        <span className="text-ink-800 group-hover:text-signal transition-colors">
                          {cat.name}
                        </span>
                      </div>
                      <span className="flex items-center gap-2">
                        <span className="text-[11px] font-medium text-gray-400">{cat.articleCount}</span>
                        <span aria-hidden="true" className="text-gray-400 group-hover:text-signal group-hover:translate-x-0.5 transition-all font-bold">
                          →
                        </span>
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript([
            breadcrumbJsonLd(breadcrumbs),
            itemListJsonLd(displayCards.map((c) => ({ name: c.name, path: c.href }))),
          ]),
        }}
      />
    </div>
  );
}
