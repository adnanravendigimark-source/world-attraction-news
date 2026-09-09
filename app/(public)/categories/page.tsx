import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import Container from "@/components/Container";
import EmptyState from "@/components/EmptyState";
import NewsletterForm from "@/components/NewsletterForm";
import { getCategories } from "@/lib/categories";
import { getPublishedArticleCountsByCategory, getLatestPublishedArticleImageByCategory } from "@/lib/articles";
import { buildMetadata, breadcrumbJsonLd, itemListJsonLd, jsonLdScript } from "@/lib/seo";
import { SITE_NAME } from "@/lib/site";

// Pure read, no searchParams — real ISR. Admin category create/edit/delete
// calls revalidatePath("/categories").
//
// See app/(public)/page.tsx for why the DB reads below go through
// unstable_cache instead of relying on `revalidate` alone.
export const revalidate = 300;

const getCategoriesPageData = unstable_cache(
  async () => {
    const [categories, counts, latestImages] = await Promise.all([
      getCategories(),
      getPublishedArticleCountsByCategory(),
      getLatestPublishedArticleImageByCategory(),
    ]);
    return { categories, counts, latestImages };
  },
  ["categories-page-data"],
  { revalidate: 300, tags: ["categories", "articles"] }
);

export const metadata: Metadata = buildMetadata({
  title: `Coverage Categories & Editorial Beats | ${SITE_NAME}`,
  description: "Browse attraction news by category — theme parks, water parks, zoos, aquariums, iconic landmarks, and museums.",
  path: "/categories",
});

const breadcrumbs = [
  { name: "Home", path: "/" },
  { name: "Categories", path: "/categories" },
];

export default async function CategoriesPage() {
  const { categories, counts, latestImages } = await getCategoriesPageData();

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
            <span className="text-slate-800">Categories</span>
          </nav>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            {/* Left Title & Tagline */}
            <div className="max-w-xl">
              <div className="flex items-center gap-2 mb-2">
                <span className="h-2 w-2 rounded-full bg-[#DC2626] animate-pulse" />
                <span className="text-[11px] font-black uppercase tracking-widest text-[#DC2626]">
                  EDITORIAL BEATS
                </span>
              </div>
              <h1 className="font-serif text-3xl sm:text-4xl lg:text-[44px] font-black tracking-tight text-[#0B1527]">
                Coverage Categories
              </h1>
              <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
                Targeted reporting across themes, venue categories, and global attraction developments.
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
                Get Category Alerts
              </h3>
              <p className="mt-1 text-[11px] text-slate-500 leading-normal">
                Stay updated on new attractions, ride tech, and venue openings worldwide.
              </p>
              <div className="mt-2.5">
                <NewsletterForm source="categories" variant="light" />
              </div>
            </div>
          </div>
        </Container>
      </div>

      {/* =========================================
          2. CATEGORIES GRID
      ========================================= */}
      <section className="py-10">
        <Container>
          {categories.length === 0 ? (
            <EmptyState
              title="No Categories Configured"
              description="Categories will appear here once defined by the editorial team in the admin panel."
            />
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((cat) => {
                const image = cat.image || latestImages[cat.id];
                const imageAlt = cat.imageAlt || cat.name;
                const count = counts[cat.id] || 0;

                return (
                  <Link
                    key={cat.id}
                    href={`/categories/${cat.slug}`}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-300 hover:-translate-y-0.5"
                  >
                    <div className="relative h-44 sm:h-48 w-full overflow-hidden bg-slate-900">
                      {image ? (
                        <Image
                          src={image}
                          alt={imageAlt}
                          fill
                          sizes="(min-width: 1024px) 33vw, 50vw"
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center bg-[#0B1527]">
                          <span className="font-serif text-2xl font-black text-white/40">{cat.name}</span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0B1527] via-[#0B1527]/30 to-transparent" />

                      <span className="absolute right-3 top-3 rounded-full bg-black/60 backdrop-blur-md px-3 py-1 text-[10px] font-bold text-white border border-white/20">
                        {count} {count === 1 ? "story" : "stories"}
                      </span>

                      <div className="absolute bottom-0 left-0 p-4">
                        <p className="font-sans text-xl sm:text-2xl font-black text-white group-hover:text-red-200 transition-colors">
                          {cat.name}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-1 flex-col p-5">
                      <p className="line-clamp-2 text-xs sm:text-[13px] text-slate-600 leading-relaxed font-normal">
                        {cat.description || "Comprehensive travel and attraction reporting across this editorial category."}
                      </p>

                      <div className="mt-auto pt-3 text-xs font-black uppercase tracking-wider text-[#DC2626] flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                        <span>Explore {cat.name}</span>
                        <span>→</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: jsonLdScript([
                breadcrumbJsonLd(breadcrumbs),
                itemListJsonLd(categories.map((c) => ({ name: c.name, path: `/categories/${c.slug}` }))),
              ]),
            }}
          />
        </Container>
      </section>
    </div>
  );
}
