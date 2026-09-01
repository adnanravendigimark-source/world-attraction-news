import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Container from "@/components/Container";
import Breadcrumbs from "@/components/Breadcrumbs";
import ArticleCard from "@/components/ArticleCard";
import SectionHeading from "@/components/SectionHeading";
import EmptyState from "@/components/EmptyState";
import Pagination from "@/components/Pagination";
import { getCategoryBySlug } from "@/lib/categories";
import { getPublishedArticlesPage } from "@/lib/articles";
import { buildMetadata, breadcrumbJsonLd, itemListJsonLd } from "@/lib/seo";
import { SITE_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: { categorySlug: string };
  searchParams: { page?: string };
}): Promise<Metadata> {
  const category = await getCategoryBySlug(params.categorySlug);
  if (!category) return {};
  const isPaginated = Boolean(searchParams?.page && searchParams.page !== "1");
  return buildMetadata({
    title: `${category.name} | ${SITE_NAME}`,
    description: category.description || `The latest ${category.name.toLowerCase()} news from attractions around the world.`,
    path: `/categories/${category.slug}`,
    noIndex: isPaginated,
  });
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: { categorySlug: string };
  searchParams: { page?: string };
}) {
  const category = await getCategoryBySlug(params.categorySlug);
  if (!category) notFound();

  const page = Math.max(1, Number(searchParams?.page) || 1);
  const { articles, total, totalPages } = await getPublishedArticlesPage({ categorySlug: category.slug, page, pageSize: 9 });

  const featured = page === 1 ? articles[0] : undefined;
  const gridArticles = page === 1 ? articles.slice(1) : articles;

  // Cities that have coverage in this category, derived from the articles
  // actually on this page's result set (real data, not a separate guess).
  const relatedCities = Array.from(
    new Map(articles.map((a) => [a.citySlug, { slug: a.citySlug, name: a.cityName }])).values()
  ).slice(0, 6);

  const breadcrumbs = [
    { name: "Home", path: "/" },
    { name: "Categories", path: "/categories" },
    { name: category.name, path: `/categories/${category.slug}` },
  ];

  return (
    <Container className="py-10 sm:py-14">
      <Breadcrumbs items={breadcrumbs} />
      <h1 className="mt-3 font-serif text-2xl font-bold text-ink-900 sm:text-3xl">{category.name}</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-600">
        {category.description || `The latest ${category.name.toLowerCase()} news from attractions around the world.`}
        {" "}{total > 0 && `${total} ${total === 1 ? "story" : "stories"}.`}
      </p>

      {articles.length === 0 ? (
        <div className="mt-8">
          <EmptyState title={`No ${category.name.toLowerCase()} articles yet`} description="Check back soon, or browse another category." actionLabel="Browse all categories" actionHref="/categories" />
        </div>
      ) : (
        <>
          {featured && (
            <div className="mt-8">
              <ArticleCard article={featured} size="large" />
            </div>
          )}

          {gridArticles.length > 0 && (
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {gridArticles.map((a) => (
                <ArticleCard key={a.id} article={a} />
              ))}
            </div>
          )}

          <Pagination page={page} totalPages={totalPages} basePath={`/categories/${category.slug}`} />
        </>
      )}

      {relatedCities.length > 0 && (
        <div className="mt-14 border-t border-ink-200 pt-8">
          <SectionHeading eyebrow="Where this is happening" title="Related Cities" />
          <div className="mt-4 flex flex-wrap gap-2">
            {relatedCities.map((c) => (
              <Link
                key={c.slug}
                href={`/cities/${c.slug}`}
                className="rounded-full border border-ink-200 px-3.5 py-1.5 text-xs font-semibold text-ink-700 hover:border-signal hover:text-signal"
              >
                {c.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            breadcrumbJsonLd(breadcrumbs),
            itemListJsonLd(articles.map((a) => ({ name: a.title, path: `/cities/${a.citySlug}/${a.slug}` }))),
          ]),
        }}
      />
    </Container>
  );
}
