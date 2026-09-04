import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Container from "@/components/Container";
import EmptyState from "@/components/EmptyState";
import NewsletterForm from "@/components/NewsletterForm";
import { getCityBySlug } from "@/lib/cities";
import { getAttractionsByCityId, getPublishedArticleCountsByAttraction } from "@/lib/attractions";
import { buildMetadata, breadcrumbJsonLd } from "@/lib/seo";
import { SITE_NAME } from "@/lib/site";

// Pure read, no searchParams — real ISR. Admin attraction create/edit/delete
// calls revalidatePath(`/cities/${citySlug}/attractions`).
export const revalidate = 180;

export async function generateMetadata({ params }: { params: { citySlug: string } }): Promise<Metadata> {
  const city = await getCityBySlug(params.citySlug);
  if (!city) return {};
  return buildMetadata({
    title: `${city.name} Attractions — Top Theme Parks & Landmarks | ${SITE_NAME}`,
    description: `Browse attractions, theme parks, and historic landmarks we cover in ${city.name} — news and visitor guides.`,
    path: `/cities/${city.slug}/attractions`,
  });
}

export default async function CityAttractionsPage({ params }: { params: { citySlug: string } }) {
  const city = await getCityBySlug(params.citySlug);
  if (!city) notFound();

  const [attractions, counts] = await Promise.all([
    getAttractionsByCityId(city.id),
    getPublishedArticleCountsByAttraction(),
  ]);

  const breadcrumbs = [
    { name: "Home", path: "/" },
    { name: "Destinations", path: "/cities" },
    { name: city.name, path: `/cities/${city.slug}` },
    { name: "Attractions", path: `/cities/${city.slug}/attractions` },
  ];

  const totalStories = Object.values(counts).reduce((a, b) => a + b, 0);

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
            <Link href="/cities" className="hover:text-slate-900 transition-colors">
              Destinations
            </Link>
            <span>&gt;</span>
            <Link href={`/cities/${city.slug}`} className="hover:text-slate-900 transition-colors">
              {city.name}
            </Link>
            <span>&gt;</span>
            <span className="text-slate-800">Attractions</span>
          </nav>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            {/* Left Title & Tagline */}
            <div className="max-w-xl">
              <div className="flex items-center gap-2 mb-2">
                <span className="h-2 w-2 rounded-full bg-[#DC2626] animate-pulse" />
                <span className="text-[11px] font-black uppercase tracking-widest text-[#DC2626]">
                  {city.name.toUpperCase()} BUREAU
                </span>
              </div>
              <h1 className="font-serif text-3xl sm:text-4xl lg:text-[44px] font-black tracking-tight text-[#0B1527]">
                {city.name} Attractions
              </h1>
              <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
                Comprehensive guide, opening dates, and news wire for theme parks, landmarks, and venues in {city.name}.
              </p>
            </div>

            {/* Right: Get Alerts Box */}
            <div className="relative rounded-xl border border-rose-100/80 bg-rose-50/40 p-4 sm:p-5 lg:w-[380px] overflow-hidden">
              <div className="absolute right-2 -bottom-4 opacity-15 pointer-events-none">
                <svg className="w-32 h-32 text-rose-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              </div>

              <h3 className="font-sans text-xs font-black uppercase tracking-wider text-[#0B1527]">
                GET {city.name.toUpperCase()} ALERTS
              </h3>
              <p className="mt-1 text-[11px] text-slate-500 leading-normal">
                Stay updated on new attractions, ride tech, and venue openings in {city.name}.
              </p>
              <div className="mt-2.5">
                <NewsletterForm source={`city-${city.slug}-attractions`} variant="light" />
              </div>
            </div>
          </div>
        </Container>
      </div>

      {/* =========================================
          2. MAIN CONTENT WITH ATTRACTIONS GRID
      ========================================= */}
      <section className="py-8 sm:py-10">
        <Container>
          <div className="border-b border-slate-200 pb-3 mb-6 flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-widest text-[#DC2626]">
              {attractions.length} ATTRACTIONS IN {city.name.toUpperCase()}
              {totalStories > 0 && <span className="text-slate-400 normal-case font-bold"> · {totalStories} {totalStories === 1 ? "story" : "stories"} total</span>}
            </span>
          </div>

          {attractions.length === 0 ? (
            <EmptyState
              title={`No Attractions Listed for ${city.name} Yet`}
              description="Our editorial desk is adding venue guides and theme park dossiers for this city."
              actionLabel={`View ${city.name} News Wire`}
              actionHref={`/cities/${city.slug}`}
            />
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {attractions.map((a) => {
                const count = counts[a.id] || 0;
                return (
                  <Link
                    key={a.id}
                    href={`/cities/${city.slug}/attractions/${a.slug}`}
                    className="group flex flex-col rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-300 hover:-translate-y-0.5"
                  >
                    <div className="relative h-48 w-full overflow-hidden bg-slate-900">
                      {a.heroImage ? (
                        <Image
                          src={a.heroImage}
                          alt={a.heroImageAlt || a.name}
                          fill
                          sizes="(min-width: 1024px) 33vw, 50vw"
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center bg-[#0B1527]">
                          <span className="font-serif text-xl font-black text-white/40">{a.name}</span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0B1527] via-[#0B1527]/30 to-transparent" />

                      <span className="absolute top-3 right-3 rounded-full bg-black/60 backdrop-blur-md px-2.5 py-0.5 text-[10px] font-bold text-white border border-white/10">
                        {count} {count === 1 ? "story" : "stories"}
                      </span>

                      <div className="absolute bottom-3 left-4 text-white">
                        <h2 className="font-sans text-xl font-black leading-tight text-white group-hover:text-red-200 transition-colors">
                          {a.name}
                        </h2>
                      </div>
                    </div>

                    <div className="flex flex-1 flex-col p-4 sm:p-5">
                      <p className="text-xs text-slate-600 leading-relaxed line-clamp-3 mb-4">
                        {a.description || `Explore opening dates, ticket tips, and latest reporting on ${a.name}.`}
                      </p>

                      <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-wider text-[#DC2626] flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                          <span>Explore Venue Dossier</span>
                          <span aria-hidden="true">→</span>
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
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
                🎡
              </div>
              <div>
                <h3 className="font-sans text-sm sm:text-base font-black text-[#0B1527]">
                  Get Attraction Opening Alerts for {city.name}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500 leading-relaxed max-w-lg">
                  Receive breaking ride announcements, queue tips, and ticket discounts straight to your inbox.
                </p>
              </div>
            </div>

            <div className="w-full md:w-auto">
              <NewsletterForm source={`city-${city.slug}-attractions-footer`} variant="light" />
            </div>
          </div>
        </Container>
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(breadcrumbs)) }} />
    </div>
  );
}
