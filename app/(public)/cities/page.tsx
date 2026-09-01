import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import Container from "@/components/Container";
import Breadcrumbs from "@/components/Breadcrumbs";
import EmptyState from "@/components/EmptyState";
import { getCitiesWithArticleCounts } from "@/lib/cities";
import { getPublishedArticles } from "@/lib/articles";
import { buildMetadata, breadcrumbJsonLd, itemListJsonLd } from "@/lib/seo";
import { SITE_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildMetadata({
  title: `All Cities | ${SITE_NAME}`,
  description: "Browse attraction news by city — every destination we cover, in one place.",
  path: "/cities",
});

const breadcrumbs = [{ name: "Home", path: "/" }, { name: "Cities", path: "/cities" }];

export default async function CitiesPage() {
  const cities = await getCitiesWithArticleCounts();

  // One extra query for the latest headline per city, run in parallel —
  // real data (the actual most recent published article), not a guess.
  const latestByCity = await Promise.all(
    cities.map((c) => getPublishedArticles({ citySlug: c.slug, limit: 1 }))
  );

  return (
    <Container className="py-10 sm:py-14">
      <Breadcrumbs items={breadcrumbs} />
      <h1 className="mt-3 font-serif text-2xl font-bold text-ink-900 sm:text-3xl">All Cities</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-600">
        Every city we cover — each page collects the latest attraction news written by our local contributors there.
      </p>

      {cities.length === 0 ? (
        <div className="mt-8">
          <EmptyState title="No cities yet" description="Cities will appear here once the editorial team adds them." />
        </div>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {cities.map((c, i) => {
            const latest = latestByCity[i][0];
            return (
              <Link
                key={c.id}
                href={`/cities/${c.slug}`}
                className="group flex flex-col overflow-hidden rounded-lg border border-ink-100 bg-white shadow-card transition-shadow hover:shadow-lift"
              >
                <div className="relative h-40 w-full overflow-hidden bg-ink-100">
                  {c.heroImage && (
                    <Image
                      src={c.heroImage}
                      alt={c.heroImageAlt || c.name}
                      fill
                      sizes="(min-width: 1024px) 33vw, 50vw"
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-ink-900/70 via-transparent to-transparent" />
                  <div className="absolute bottom-0 left-0 p-3.5">
                    <p className="font-serif text-lg font-bold text-white">{c.name}</p>
                    <p className="text-[11px] text-ink-200">{c.country}</p>
                  </div>
                  <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-ink-800">
                    {c.articleCount} {c.articleCount === 1 ? "story" : "stories"}
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <p className="line-clamp-2 text-sm leading-relaxed text-ink-600">{c.intro}</p>
                  {latest && (
                    <p className="mt-auto pt-3 text-xs text-ink-500">
                      Latest: <span className="font-semibold text-ink-800 group-hover:text-signal">{latest.title}</span>
                    </p>
                  )}
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
            itemListJsonLd(cities.map((c) => ({ name: c.name, path: `/cities/${c.slug}` }))),
          ]),
        }}
      />
    </Container>
  );
}
