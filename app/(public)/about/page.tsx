import type { Metadata } from "next";
import Link from "next/link";
import { unstable_cache } from "next/cache";
import Container from "@/components/Container";
import { getCities } from "@/lib/cities";
import { buildMetadata, breadcrumbJsonLd, jsonLdScript } from "@/lib/seo";
import { cityPath } from "@/lib/destinations";
import { SITE_NAME, SITE_TAGLINE, CONTACT_EMAIL } from "@/lib/site";

// Pure read (just the city list for "Active Destination Bureaus") — real ISR.
//
// See app/(public)/page.tsx for why the DB read below goes through
// unstable_cache instead of relying on `revalidate` alone.
export const revalidate = 600;

const getCachedCities = unstable_cache(() => getCities(), ["about-page-cities"], {
  revalidate: 600,
  tags: ["cities"],
});

export const metadata: Metadata = buildMetadata({
  title: `About Us — Global Attraction Intelligence & Newsroom | ${SITE_NAME}`,
  description: `${SITE_NAME} — ${SITE_TAGLINE}. Independent on-the-ground reporting on attractions, theme parks, and historic landmarks worldwide.`,
  path: "/about",
});

const breadcrumbs = [
  { name: "Home", path: "/" },
  { name: "About Us", path: "/about" },
];

export default async function AboutPage() {
  const cities = await getCachedCities();

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
            <span className="text-slate-800">About Us</span>
          </nav>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            {/* Left Title & Tagline */}
            <div className="max-w-xl">
              <div className="flex items-center gap-2 mb-2">
                <span className="h-2 w-2 rounded-full bg-[#DC2626] animate-pulse" />
                <span className="text-[11px] font-black uppercase tracking-widest text-[#DC2626]">
                  ABOUT {SITE_NAME.toUpperCase()}
                </span>
              </div>
              <h1 className="font-serif text-3xl sm:text-4xl lg:text-[44px] font-black tracking-tight text-[#0B1527]">
                About Our Newsroom
              </h1>
              <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
                {SITE_TAGLINE}. Delivering verified reporting, opening dates, and intelligence on theme parks and cultural landmarks globally.
              </p>
            </div>

            {/* Right: Get Dispatches Box */}
            <div className="relative rounded-xl border border-rose-100/80 bg-rose-50/40 p-4 sm:p-5 lg:w-[380px] overflow-hidden">
              <div className="absolute right-2 -bottom-4 opacity-15 pointer-events-none">
                <svg className="w-32 h-32 text-rose-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              </div>

              <h3 className="font-sans text-xs font-black uppercase tracking-wider text-[#0B1527]">
                Connect With Us
              </h3>
              <p className="mt-1 text-[11px] text-slate-500 leading-normal">
                Press inquiries, bureau partnerships, or news tips: reach out to our editorial desk.
              </p>
              <div className="mt-2.5">
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="inline-flex items-center gap-1.5 rounded-md bg-[#DC2626] px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#B91C1C] transition-colors shadow-sm"
                >
                  <span>Email Editorial Desk</span>
                  <span aria-hidden="true">→</span>
                </a>
              </div>
            </div>
          </div>
        </Container>
      </div>

      {/* =========================================
          2. STATS & MISSION CARDS
      ========================================= */}
      <section className="py-10">
        <Container>
          {/* Key Stats Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            <div className="p-5 rounded-2xl border border-slate-200 bg-white text-center shadow-sm">
              <p className="text-2xl sm:text-3xl font-black text-[#DC2626]">{cities.length}</p>
              <p className="text-xs font-bold text-slate-600 mt-1 uppercase tracking-wider">Global City Bureaus</p>
            </div>
            <div className="p-5 rounded-2xl border border-slate-200 bg-white text-center shadow-sm">
              <p className="text-2xl sm:text-3xl font-black text-[#0B1527]">100%</p>
              <p className="text-xs font-bold text-slate-600 mt-1 uppercase tracking-wider">Independent Coverage</p>
            </div>
            <div className="p-5 rounded-2xl border border-slate-200 bg-white text-center shadow-sm">
              <p className="text-2xl sm:text-3xl font-black text-[#DC2626]">24/7</p>
              <p className="text-xs font-bold text-slate-600 mt-1 uppercase tracking-wider">Continuous Wire</p>
            </div>
            <div className="p-5 rounded-2xl border border-slate-200 bg-white text-center shadow-sm">
              <p className="text-2xl sm:text-3xl font-black text-[#0B1527]">0</p>
              <p className="text-xs font-bold text-slate-600 mt-1 uppercase tracking-wider">Sponsored Reviews</p>
            </div>
          </div>

          {/* Core Content Grid */}
          <div className="grid gap-8 lg:grid-cols-12 items-start">
            <div className="lg:col-span-8 flex flex-col gap-8">
              {/* Pillar 1 */}
              <div className="p-6 sm:p-8 rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-[#DC2626] font-bold text-sm">
                    01
                  </span>
                  <h2 className="font-serif text-xl sm:text-2xl font-black text-[#0B1527]">
                    Our Philosophy &amp; Mission
                  </h2>
                </div>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
                  {SITE_NAME} was established to solve a critical issue in modern travel journalism: automated AI aggregation and undisclosed promotional listicles. We run an independent global newsroom dedicated exclusively to verified reporting on attraction expansions, opening calendars, ticket pricing, and visitor intelligence.
                </p>
              </div>

              {/* Pillar 2 */}
              <div className="p-6 sm:p-8 rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-[#DC2626] font-bold text-sm">
                    02
                  </span>
                  <h2 className="font-serif text-xl sm:text-2xl font-black text-[#0B1527]">
                    Global Bureaus &amp; Local Correspondents
                  </h2>
                </div>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal mb-4">
                  Rather than reporting remotely from a single desk, our dispatches are anchored in local tourist hubs. Each destination bureau provides first-hand coverage authored by correspondents living and researching in those regions.
                </p>

                {cities.length > 0 && (
                  <div className="pt-4 border-t border-slate-100">
                    <p className="text-xs font-bold text-slate-700 mb-2.5 uppercase tracking-wider">Active Destination Bureaus:</p>
                    <div className="flex flex-wrap gap-2">
                      {cities.map((c) => (
                        <Link
                          key={c.id}
                          href={cityPath(c.countrySlug, c.slug)}
                          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-800 hover:border-[#DC2626] hover:text-[#DC2626] hover:bg-white transition-all"
                        >
                          {c.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Pillar 3 */}
              <div className="p-6 sm:p-8 rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-[#DC2626] font-bold text-sm">
                    03
                  </span>
                  <h2 className="font-serif text-xl sm:text-2xl font-black text-[#0B1527]">
                    Strict Editorial Independence
                  </h2>
                </div>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
                  We do not accept paid reviews, undisclosed press trips, or sponsored placements. Every dispatch published undergoes rigorous editorial fact-checking, photo verification, and scoring before syndication.
                </p>
              </div>
            </div>

            {/* Right Sidebar: Join Network */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              <div className="p-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
                <h3 className="font-sans text-xs sm:text-sm font-black uppercase tracking-wider text-[#0B1527] mb-2">
                  Write for Attraction News
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                  Are you an attraction researcher, local correspondent, or travel journalist? Join our global contributor network.
                </p>
                <div className="flex flex-col gap-2.5">
                  <Link
                    href="/write-for-us"
                    className="w-full text-center rounded-lg bg-[#DC2626] py-2.5 text-xs font-black uppercase tracking-wider text-white hover:bg-[#B91C1C] transition-colors shadow-sm"
                  >
                    View Guidelines &amp; Perks
                  </Link>
                  <Link
                    href="/signup"
                    className="w-full text-center rounded-lg border border-slate-200 bg-slate-50 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-700 hover:bg-white hover:border-slate-400 transition-colors"
                  >
                    Apply as Contributor
                  </Link>
                </div>
              </div>

              <div className="p-6 rounded-2xl border border-slate-200 bg-slate-50 shadow-sm">
                <h3 className="font-sans text-xs font-black uppercase tracking-wider text-[#0B1527] mb-2">
                  Editorial Desk Contact
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed mb-3">
                  For press kits, corrections, or scoops:
                </p>
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="text-xs font-bold text-[#DC2626] hover:underline break-all"
                >
                  {CONTACT_EMAIL}
                </a>
              </div>
            </div>
          </div>
        </Container>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbJsonLd(breadcrumbs)) }}
      />
    </div>
  );
}
