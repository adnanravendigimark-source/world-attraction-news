import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Container from "@/components/Container";
import Breadcrumbs from "@/components/Breadcrumbs";
import ArticleCard from "@/components/ArticleCard";
import SectionHeading from "@/components/SectionHeading";
import EmptyState from "@/components/EmptyState";
import { getAttractionBySlug } from "@/lib/attractions";
import { getPublishedArticles } from "@/lib/articles";
import { buildMetadata, breadcrumbJsonLd, itemListJsonLd } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { citySlug: string; attractionSlug: string };
}): Promise<Metadata> {
  const attraction = await getAttractionBySlug(params.citySlug, params.attractionSlug);
  if (!attraction) return {};
  return buildMetadata({
    title: attraction.metaTitle || `${attraction.name} News & Guides — ${attraction.cityName}`,
    description: attraction.metaDescription || attraction.description || `News and visitor guides for ${attraction.name} in ${attraction.cityName}.`,
    path: `/cities/${attraction.citySlug}/attractions/${attraction.slug}`,
    image: attraction.heroImage,
  });
}

export default async function AttractionPage({
  params,
}: {
  params: { citySlug: string; attractionSlug: string };
}) {
  const attraction = await getAttractionBySlug(params.citySlug, params.attractionSlug);
  if (!attraction) notFound();

  const articles = await getPublishedArticles({ attractionSlug: attraction.slug, citySlug: attraction.citySlug });

  const breadcrumbs = [
    { name: "Home", path: "/" },
    { name: "Cities", path: "/cities" },
    { name: attraction.cityName, path: `/cities/${attraction.citySlug}` },
    { name: "Attractions", path: `/cities/${attraction.citySlug}/attractions` },
    { name: attraction.name, path: `/cities/${attraction.citySlug}/attractions/${attraction.slug}` },
  ];

  return (
    <>
      <section className="relative border-b border-ink-200">
        {attraction.heroImage ? (
          <div className="relative h-56 w-full sm:h-72">
            <Image src={attraction.heroImage} alt={attraction.heroImageAlt || attraction.name} fill priority className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-ink-900/85 via-ink-900/30 to-transparent" />
          </div>
        ) : (
          <div className="h-32 w-full bg-ink-900" />
        )}
        <Container className={attraction.heroImage ? "absolute inset-x-0 bottom-0 pb-5" : "py-5"}>
          <div className="mb-2">
            <Breadcrumbs items={breadcrumbs} />
          </div>
          <h1 className={`font-serif text-2xl font-bold sm:text-3xl ${attraction.heroImage ? "text-white" : "text-ink-900"}`}>{attraction.name}</h1>
          <p className={`text-xs ${attraction.heroImage ? "text-ink-200" : "text-ink-500"}`}>
            {attraction.cityName} · {articles.length} {articles.length === 1 ? "story" : "stories"}
          </p>
        </Container>
      </section>

      {attraction.description && (
        <Container className="py-6">
          <p className="max-w-3xl text-sm leading-relaxed text-ink-600">{attraction.description}</p>
        </Container>
      )}

      <Container className="pb-16">
        <SectionHeading title={`Latest on ${attraction.name}`} />
        {articles.length === 0 ? (
          <div className="mt-6">
            <EmptyState title="No published articles yet" description={`Check back soon for coverage of ${attraction.name}.`} />
          </div>
        ) : (
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
