import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { unstable_cache } from "next/cache";
import Container from "@/components/Container";
import EmptyState from "@/components/EmptyState";
import NewsletterForm from "@/components/NewsletterForm";
import { getCitiesByCountrySlug } from "@/lib/cities";
import { buildMetadata, breadcrumbJsonLd, itemListJsonLd, jsonLdScript } from "@/lib/seo";
import { cityPath, countryPath } from "@/lib/destinations";
import { SITE_NAME } from "@/lib/site";

// Pure read, no searchParams — real ISR. Admin city create/edit/delete calls
// revalidatePath(`/destinations/${countrySlug}`).
//
// See app/(public)/page.tsx for why the DB read below must go through
// unstable_cache (not just this `revalidate` export) to actually be cached.
export const revalidate = 300;

const getCachedCountryCities = unstable_cache(
  (countrySlug: string) => getCitiesByCountrySlug(countrySlug),
  ["country-cities"],
  { revalidate: 300, tags: ["cities"] }
);

export async function generateMetadata({ params }: { params: { countrySlug: string } }): Promise<Metadata> {
  const cities = await getCachedCountryCities(params.countrySlug);
  if (!cities.length) return {};
  const countryName = cities[0].country;
  return buildMetadata({
    title: `${countryName} Destinations — Attraction News & Travel Updates | ${SITE_NAME}`,
    description: `Explore attraction news and travel updates from ${countryName}'s cities: ${cities.map((c) => c.name).join(", ")}.`,
    path: countryPath(params.countrySlug),
  });
}

export default async function CountryPage({ params }: { params: { countrySlug: string } }) {
  const cities = await getCachedCountryCities(params.countrySlug);
  if (!cities.length) notFound();

  const countryName = cities[0].country;
  const totalStories = cities.reduce((sum, c) => sum + (c.articleCount || 0), 0);

  const breadcrumbs = [
    { name: "Home", path: "/" },
    { name: "Destinations", path: "/destinations" },
    { name: countryName, path: countryPath(params.countrySlug) },
  ];

  return (
    <div className="bg-white min-h-screen text-[#0B1527] pb-16">
      {/* =========================================
          1. BREADCRUMBS & HERO HEADER
      ========================================= */}
      <div className="border-b border-slate-100 bg-white pt-5 pb-8">
        <Container>
          <nav className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 mb-4">
            <Link href="/" className="hover:text-slate-900 transition-colors">
              Home
            </Link>
            <span>&gt;</span>
            <Link href="/destinations" className="hover:text-slate-900 transition-colors">
              Destinations
            </Link>
            <span>&gt;</span>
            <span className="text-slate-800">{countryName}</span>
          </nav>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="max-w-xl">
              <div className="flex items-center gap-2 mb-2">
                <span className="h-2 w-2 rounded-full bg-[#DC2626] animate-pulse" />
                <span className="text-[11px] font-black uppercase tracking-widest text-[#DC2626]">
                  COUNTRY BUREAU
                </span>
              </div>
              <h1 className="font-serif text-3xl sm:text-4xl lg:text-[44px] font-black tracking-tight text-[#0B1527]">
                {countryName}
              </h1>
              <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
                {cities.length} {cities.length === 1 ? "city" : "cities"} covered
                {totalStories > 0 && <> · {totalStories} {totalStories === 1 ? "dispatch" : "dispatches"}</>}
              </p>
            </div>

            <div className="relative rounded-xl border border-rose-100/80 bg-rose-50/40 p-4 sm:p-5 lg:w-[380px] overflow-hidden">
              <div className="absolute right-2 -bottom-4 opacity-15 pointer-events-none">
                <svg className="w-32 h-32 text-rose-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              </div>

              <h3 className="font-sans text-xs font-black uppercase tracking-wider text-[#0B1527]">
                GET {countryName.toUpperCase()} ALERTS
              </h3>
              <p className="mt-1 text-[11px] text-slate-500 leading-normal">
                Stay updated on city guides, theme park openings, and travel updates across {countryName}.
              </p>
              <div className="mt-2.5">
                <NewsletterForm source={`country-${params.countrySlug}`} variant="light" />
              </div>
            </div>
          </div>
        </Container>
      </div>

      {/* =========================================
          2. CITIES GRID
      ========================================= */}
      <section className="py-8 sm:py-10">
        <Container>
          <div className="border-b border-slate-200 pb-3 mb-6">
            <span className="text-xs font-black uppercase tracking-widest text-[#DC2626]">
              {cities.length} {cities.length === 1 ? "CITY" : "CITIES"} IN {countryName.toUpperCase()}
            </span>
          </div>

          {cities.length === 0 ? (
            <EmptyState title={`No cities listed for ${countryName} yet`} description="Check back soon." />
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {cities.map((city) => (
                <Link
                  key={city.id}
                  href={cityPath(city.countrySlug, city.slug)}
                  className="group flex flex-col rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-300 hover:-translate-y-0.5"
                >
                  <div className="relative h-48 w-full overflow-hidden bg-slate-900">
                    {city.heroImage ? (
                      <Image
                        src={city.heroImage}
                        alt={city.heroImageAlt || city.name}
                        fill
                        sizes="(min-width: 1024px) 33vw, 50vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-[#0B1527]">
                        <span className="font-serif text-xl font-black text-white/40">{city.name}</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0B1527] via-[#0B1527]/30 to-transparent" />

                    <span className="absolute top-3 right-3 rounded-full bg-black/60 backdrop-blur-md px-2.5 py-0.5 text-[10px] font-bold text-white border border-white/10">
                      {city.articleCount} {city.articleCount === 1 ? "dispatch" : "dispatches"}
                    </span>

                    <div className="absolute bottom-3 left-4 text-white">
                      <h2 className="font-sans text-xl font-black leading-tight text-white group-hover:text-red-200 transition-colors">
                        {city.name}
                      </h2>
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col p-4 sm:p-5">
                    <p className="text-xs text-slate-600 leading-relaxed line-clamp-3 mb-4">
                      {city.intro || `News and visitor updates from ${city.name}'s landmark attractions, theme parks, and historic venues.`}
                    </p>
                    <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-wider text-[#DC2626] flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                        <span>Explore {city.name}</span>
                        <span aria-hidden="true">→</span>
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Container>
      </section>

      {/* =========================================
          3. BOTTOM NEWSLETTER STRIP
      ========================================= */}
      <section className="mt-8">
        <Container>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-2xl shadow-sm">
                📬
              </div>
              <div>
                <h3 className="font-sans text-sm sm:text-base font-black text-[#0B1527]">
                  Stay Updated on {countryName}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500 leading-relaxed max-w-lg">
                  Get breaking attraction news and travel updates delivered to your inbox.
                </p>
              </div>
            </div>
            <div className="w-full md:w-auto">
              <NewsletterForm source={`country-${params.countrySlug}-footer`} variant="light" />
            </div>
          </div>
        </Container>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript([
            breadcrumbJsonLd(breadcrumbs),
            itemListJsonLd(cities.map((c) => ({ name: c.name, path: cityPath(c.countrySlug, c.slug) }))),
          ]),
        }}
      />
    </div>
  );
}
