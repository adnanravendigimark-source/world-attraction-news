import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { unstable_cache } from "next/cache";
import Image from "next/image";
import Link from "next/link";
import Container from "@/components/Container";
import Breadcrumbs from "@/components/Breadcrumbs";
import ArticleCard from "@/components/ArticleCard";
import SectionHeading from "@/components/SectionHeading";
import EmptyState from "@/components/EmptyState";
import { getAttractionBySlug } from "@/lib/attractions";
import { getPublishedArticles } from "@/lib/articles";
import { buildMetadata, breadcrumbJsonLd, itemListJsonLd } from "@/lib/seo";

// Pure read — real ISR. Admin attraction edits call
// revalidatePath(`/cities/${citySlug}/attractions/${attractionSlug}`).
//
// See app/(public)/page.tsx for why the DB reads below go through
// unstable_cache instead of relying on `revalidate` alone.
export const revalidate = 300;

const getCachedAttractionBySlug = unstable_cache(
  (citySlug: string, attractionSlug: string) => getAttractionBySlug(citySlug, attractionSlug),
  ["attraction-by-slug"],
  { revalidate: 300, tags: ["attractions"] }
);

const getCachedAttractionArticles = unstable_cache(
  (attractionSlug: string, citySlug: string) => getPublishedArticles({ attractionSlug, citySlug }),
  ["attraction-articles"],
  { revalidate: 300, tags: ["articles"] }
);

export async function generateMetadata({
  params,
}: {
  params: { citySlug: string; attractionSlug: string };
}): Promise<Metadata> {
  const attraction = await getCachedAttractionBySlug(params.citySlug, params.attractionSlug);
  if (!attraction) return {};
  return buildMetadata({
    title: attraction.metaTitle || `${attraction.name} News, Openings & Coverage — ${attraction.cityName}`,
    description: attraction.metaDescription || attraction.description || `News, ticket updates, and visitor intelligence for ${attraction.name} in ${attraction.cityName}.`,
    path: `/cities/${attraction.citySlug}/attractions/${attraction.slug}`,
    image: attraction.heroImage,
  });
}

export default async function AttractionPage({
  params,
}: {
  params: { citySlug: string; attractionSlug: string };
}) {
  const attraction = await getCachedAttractionBySlug(params.citySlug, params.attractionSlug);
  if (!attraction) notFound();

  const articles = await getCachedAttractionArticles(attraction.slug, attraction.citySlug);

  const breadcrumbs = [
    { name: "Home", path: "/" },
    { name: "Destinations", path: "/cities" },
    { name: attraction.cityName, path: `/cities/${attraction.citySlug}` },
    { name: attraction.name, path: `/cities/${attraction.citySlug}/attractions/${attraction.slug}` },
  ];

  return (
    <>
      <section className="relative border-b-2 border-ink-950 bg-ink-950">
        {attraction.heroImage ? (
          <div className="relative h-64 sm:h-80 lg:h-96 w-full">
            <Image
              src={attraction.heroImage}
              alt={attraction.heroImageAlt || attraction.name}
              fill
              priority
              className="object-cover opacity-80"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/50 to-transparent" />
          </div>
        ) : (
          <div className="h-40 w-full bg-ink-950" />
        )}
        <Container className={attraction.heroImage ? "absolute inset-x-0 bottom-0 pb-8" : "py-8"}>
          <div className="mb-3 text-paper-100">
            <Breadcrumbs items={breadcrumbs} />
          </div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Link
              href={`/cities/${attraction.citySlug}`}
              className="rounded bg-signal px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-white hover:bg-signal-dark transition-colors"
            >
              {attraction.cityName}
            </Link>
            <span className="rounded bg-white/20 backdrop-blur-md px-2.5 py-0.5 text-[10px] font-mono font-bold text-white">
              {articles.length} {articles.length === 1 ? "Report" : "Reports"}
            </span>
          </div>
          <h1 className="font-serif text-3xl sm:text-5xl font-black tracking-tight text-white">
            {attraction.name}
          </h1>
          {attraction.description && (
            <p className="mt-3 max-w-3xl text-sm sm:text-base text-ink-200 leading-relaxed">
              {attraction.description}
            </p>
          )}
        </Container>
      </section>

      <Container className="py-12 sm:py-16">
        <SectionHeading
          eyebrow="On-the-ground reporting"
          title={`Dispatches on ${attraction.name}`}
        />
        {articles.length === 0 ? (
          <div className="mt-8">
            <EmptyState
              title="No Reports Published Yet"
              description={`Our contributors are covering news and updates for ${attraction.name}. Check back soon.`}
              actionLabel={`Browse ${attraction.cityName}`}
              actionHref={`/cities/${attraction.citySlug}`}
            />
          </div>
        ) : (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((a) => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </div>
        )}
      </Container>

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
