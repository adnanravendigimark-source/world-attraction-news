import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Container from "@/components/Container";
import Breadcrumbs from "@/components/Breadcrumbs";
import ArticleCard from "@/components/ArticleCard";
import SectionHeading from "@/components/SectionHeading";
import EmptyState from "@/components/EmptyState";
import { getCityBySlug, getCitiesWithArticleCounts } from "@/lib/cities";
import { getCategories } from "@/lib/categories";
import { getPublishedArticles } from "@/lib/articles";
import { buildMetadata, breadcrumbJsonLd, itemListJsonLd } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { citySlug: string } }): Promise<Metadata> {
  const city = await getCityBySlug(params.citySlug);
  if (!city) return {};
  return buildMetadata({
    title: city.metaTitle || `${city.name} Attraction News`,
    description: city.metaDescription || city.intro,
    path: `/cities/${city.slug}`,
    image: city.heroImage,
  });
}

export default async function CityPage({
  params,
  searchParams,
}: {
  params: { citySlug: string };
  searchParams: { category?: string };
}) {
  const city = await getCityBySlug(params.citySlug);
  if (!city) notFound();

  const activeCategoryFilter = searchParams?.category;
  const [articles, categories, allCities] = await Promise.all([
    getPublishedArticles({ citySlug: city.slug, categorySlug: activeCategoryFilter }),
    getCategories(),
    getCitiesWithArticleCounts(),
  ]);

  const activeCategory = activeCategoryFilter ? categories.find((c) => c.slug === activeCategoryFilter) : undefined;
  const [featured, ...rest] = articles;
  const popularInCity = !activeCategoryFilter
    ? [...articles].filter((a) => a.score !== null).sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 3)
    : [];
  const relatedCities = allCities.filter((c) => c.id !== city.id).sort((a, b) => b.articleCount - a.articleCount).slice(0, 4);

  const breadcrumbs = [
    { name: "Home", path: "/" },
    { name: "Cities", path: "/cities" },
    { name: city.name, path: `/cities/${city.slug}` },
  ];

  return (
    <>
      <section className="relative border-b border-ink-200">
        <div className="relative h-56 w-full sm:h-72">
          {city.heroImage && (
            <Image src={city.heroImage} alt={city.heroImageAlt || city.name} fill priority className="object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-ink-900/85 via-ink-900/30 to-transparent" />
        </div>
        <Container className="absolute inset-x-0 bottom-0 pb-5">
          <div className="mb-2">
            <Breadcrumbs items={breadcrumbs} />
          </div>
          <h1 className="font-serif text-2xl font-bold text-white sm:text-3xl">{city.name} Attraction News</h1>
          <p className="text-xs text-ink-200">
            {city.country} · {articles.length} {articles.length === 1 ? "story" : "stories"}
          </p>
        </Container>
      </section>

      <Container className="py-6">
        <p className="max-w-3xl text-sm leading-relaxed text-ink-600">{city.intro}</p>
      </Container>

      {featured && !activeCategoryFilter && (
        <Container className="pb-8">
          <SectionHeading eyebrow="Featured" title={`Top Story from ${city.name}`} />
          <div className="mt-4">
            <ArticleCard article={featured} size="large" />
          </div>
        </Container>
      )}

      {categories.length > 0 && (
        <Container className="pb-6">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-500">Browse by Category</p>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/cities/${city.slug}`}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                !activeCategoryFilter ? "border-signal bg-signal-light text-signal" : "border-ink-200 bg-white text-ink-600 hover:border-signal hover:text-signal"
              }`}
            >
              All
            </Link>
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/cities/${city.slug}?category=${cat.slug}`}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  activeCategoryFilter === cat.slug ? "border-signal bg-signal-light text-signal" : "border-ink-200 bg-white text-ink-600 hover:border-signal hover:text-signal"
                }`}
              >
                {cat.name}
              </Link>
            ))}
          </div>
        </Container>
      )}

      <Container className="pb-16">
        <SectionHeading title={activeCategory ? `${activeCategory.name} in ${city.name}` : `Latest from ${city.name}`} />
        {articles.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              title={`No published articles${activeCategory ? ` in ${activeCategory.name}` : ""} for ${city.name} yet`}
              description="Check back soon, or browse another category."
            />
          </div>
        ) : (
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {(activeCategoryFilter ? articles : rest).map((a) => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </div>
        )}
      </Container>

      {popularInCity.length > 0 && (
        <section className="border-t border-ink-200 bg-ink-50 py-10 sm:py-12">
          <Container>
            <SectionHeading eyebrow="Reader favorites" title={`Popular in ${city.name}`} />
            <div className="mt-6 grid gap-x-8 gap-y-1 sm:grid-cols-3">
              {popularInCity.map((a, i) => (
                <ArticleCard key={a.id} article={a} size="compact" rank={i + 1} />
              ))}
            </div>
          </Container>
        </section>
      )}

      {relatedCities.length > 0 && (
        <section className="border-t border-ink-200 bg-white py-10 sm:py-12">
          <Container>
            <SectionHeading eyebrow="Keep exploring" title="Other Cities We Cover" href="/cities" />
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {relatedCities.map((c) => (
                <Link
                  key={c.id}
                  href={`/cities/${c.slug}`}
                  className="group relative flex h-28 items-end overflow-hidden rounded-lg border border-ink-100 shadow-card"
                >
                  {c.heroImage && (
                    <Image src={c.heroImage} alt={c.heroImageAlt || c.name} fill sizes="25vw" className="object-cover transition-transform duration-300 group-hover:scale-105" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-ink-900/80 via-ink-900/10 to-transparent" />
                  <div className="relative z-10 px-3 py-2.5">
                    <p className="font-serif text-sm font-bold text-white">{c.name}</p>
                  </div>
                </Link>
              ))}
            </div>
          </Container>
        </section>
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
    </>
  );
}
