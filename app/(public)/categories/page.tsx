import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import Container from "@/components/Container";
import Breadcrumbs from "@/components/Breadcrumbs";
import EmptyState from "@/components/EmptyState";
import { getCategories } from "@/lib/categories";
import { getPublishedArticles, getPublishedArticleCountsByCategory } from "@/lib/articles";
import { buildMetadata, breadcrumbJsonLd, itemListJsonLd } from "@/lib/seo";
import { SITE_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildMetadata({
  title: `All Categories | ${SITE_NAME}`,
  description: "Browse attraction news by category — tickets, openings, events, and more.",
  path: "/categories",
});

const breadcrumbs = [{ name: "Home", path: "/" }, { name: "Categories", path: "/categories" }];

export default async function CategoriesPage() {
  const [categories, counts] = await Promise.all([getCategories(), getPublishedArticleCountsByCategory()]);

  // One representative image per category, taken from its own latest
  // published article — real editorial photography, not a stock icon.
  const latestByCategory = await Promise.all(
    categories.map((c) => getPublishedArticles({ categorySlug: c.slug, limit: 1 }))
  );

  return (
    <Container className="py-10 sm:py-14">
      <Breadcrumbs items={breadcrumbs} />
      <h1 className="mt-3 font-serif text-2xl font-bold text-ink-900 sm:text-3xl">All Categories</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-600">
        Every category we cover, from new attraction openings to ticket and pricing changes.
      </p>

      {categories.length === 0 ? (
        <div className="mt-8">
          <EmptyState title="No categories yet" description="Categories will appear here once the editorial team adds them." />
        </div>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat, i) => {
            const image = latestByCategory[i][0]?.image;
            const count = counts[cat.id] || 0;
            return (
              <Link
                key={cat.id}
                href={`/categories/${cat.slug}`}
                className="group flex flex-col overflow-hidden rounded-lg border border-ink-100 bg-white shadow-card transition-shadow hover:shadow-lift"
              >
                <div className="relative h-32 w-full overflow-hidden bg-ink-100">
                  {image ? (
                    <Image src={image} alt={cat.name} fill sizes="(min-width: 1024px) 33vw, 50vw" className="object-cover transition-transform duration-300 group-hover:scale-105" />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-ink-900">
                      <span className="font-serif text-xl font-bold text-white/40">{cat.name}</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-ink-900/70 via-transparent to-transparent" />
                  <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-ink-800">
                    {count} {count === 1 ? "story" : "stories"}
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <p className="font-serif text-base font-bold text-ink-900 group-hover:text-signal">{cat.name}</p>
                  {cat.description && <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-ink-600">{cat.description}</p>}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            breadcrumbJsonLd(breadcrumbs),
            itemListJsonLd(categories.map((c) => ({ name: c.name, path: `/categories/${c.slug}` }))),
          ]),
        }}
      />
    </Container>
  );
}
