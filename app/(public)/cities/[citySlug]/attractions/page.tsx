import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Container from "@/components/Container";
import Breadcrumbs from "@/components/Breadcrumbs";
import EmptyState from "@/components/EmptyState";
import { getCityBySlug } from "@/lib/cities";
import { getAttractionsByCityId, getPublishedArticleCountsByAttraction } from "@/lib/attractions";
import { buildMetadata, breadcrumbJsonLd } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { citySlug: string } }): Promise<Metadata> {
  const city = await getCityBySlug(params.citySlug);
  if (!city) return {};
  return buildMetadata({
    title: `${city.name} Attractions`,
    description: `Browse attractions we cover in ${city.name} — news and visitor guides organized by landmark.`,
    path: `/cities/${city.slug}/attractions`,
  });
}

export default async function CityAttractionsPage({ params }: { params: { citySlug: string } }) {
  const city = await getCityBySlug(params.citySlug);
  if (!city) notFound();

  const [attractions, counts] = await Promise.all([getAttractionsByCityId(city.id), getPublishedArticleCountsByAttraction()]);

  const breadcrumbs = [
    { name: "Home", path: "/" },
    { name: "Cities", path: "/cities" },
    { name: city.name, path: `/cities/${city.slug}` },
    { name: "Attractions", path: `/cities/${city.slug}/attractions` },
  ];

  return (
    <>
      <Container className="py-6">
        <Breadcrumbs items={breadcrumbs} />
        <h1 className="mt-2 font-serif text-2xl font-bold text-ink-900 sm:text-3xl">{city.name} Attractions</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-600">
          Coverage organized by landmark and attraction within {city.name}.
        </p>
      </Container>

      <Container className="pb-16">
        {attractions.length === 0 ? (
          <EmptyState title="No attractions listed yet" description={`We haven't added specific attractions for ${city.name} yet — check the city page for all coverage.`} />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {attractions.map((a) => (
              <Link
                key={a.id}
                href={`/cities/${city.slug}/attractions/${a.slug}`}
                className="group overflow-hidden rounded-lg border border-ink-200 bg-white shadow-card transition-shadow hover:shadow-lift"
              >
                <div className="relative aspect-[16/10] bg-ink-100">
                  {a.heroImage && (
                    <Image src={a.heroImage} alt={a.heroImageAlt || a.name} fill sizes="33vw" className="object-cover transition-transform duration-300 group-hover:scale-105" />
                  )}
                </div>
                <div className="p-4">
                  <h2 className="font-serif text-base font-bold text-ink-900 group-hover:text-signal">{a.name}</h2>
                  <p className="mt-1 text-xs text-ink-500">
                    {counts[a.id] || 0} article{(counts[a.id] || 0) === 1 ? "" : "s"}
                  </p>
                  {a.description && <p className="mt-2 line-clamp-2 text-xs text-ink-600">{a.description}</p>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </Container>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(breadcrumbs)) }} />
    </>
  );
}
