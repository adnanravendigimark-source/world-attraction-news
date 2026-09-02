"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Container from "@/components/Container";
import NewsletterForm from "@/components/NewsletterForm";
import EmptyState from "@/components/EmptyState";

export interface DestinationCity {
  id: string;
  slug: string;
  name: string;
  country: string;
  region?: string;
  intro?: string;
  heroImage?: string;
  heroImageAlt?: string;
  articleCount?: number;
  isPopular?: boolean;
}

// Real country -> continent lookup used only to group the site's actual
// cities for the region filter — not fabricated destination data. Any
// country not listed here falls back to "Other" rather than being silently
// (and incorrectly) lumped into Europe.
const COUNTRY_TO_REGION: Record<string, string> = {
  Spain: "Europe", France: "Europe", Italy: "Europe", "United Kingdom": "Europe",
  Netherlands: "Europe", Germany: "Europe", Portugal: "Europe", Greece: "Europe",
  Austria: "Europe", Switzerland: "Europe", Belgium: "Europe", Ireland: "Europe",
  "United States": "North America", Canada: "North America", Mexico: "North America",
  Japan: "Asia", Singapore: "Asia", "United Arab Emirates": "Asia", China: "Asia",
  Thailand: "Asia", "South Korea": "Asia", India: "Asia", Indonesia: "Asia",
  Brazil: "South America", Argentina: "South America", Peru: "South America", Chile: "South America",
  Australia: "Oceania", "New Zealand": "Oceania",
  Egypt: "Africa", Morocco: "Africa", "South Africa": "Africa", Kenya: "Africa",
};

function regionForCountry(country: string): string {
  return COUNTRY_TO_REGION[country] || "Other";
}

const REGION_ORDER = ["Europe", "North America", "Asia", "South America", "Oceania", "Africa", "Other"];

export default function DestinationsClient({
  dbCities = [],
}: {
  dbCities?: DestinationCity[];
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState("popular");

  const allDestinations = useMemo(
    () => dbCities.map((c) => ({ ...c, region: c.region || regionForCountry(c.country) })),
    [dbCities]
  );

  // Real counts computed from the actual city list — no static/fabricated
  // numbers.
  const regions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const d of allDestinations) counts.set(d.region, (counts.get(d.region) || 0) + 1);
    return REGION_ORDER.filter((r) => counts.has(r)).map((r) => ({ id: r, label: r, count: counts.get(r) || 0 }));
  }, [allDestinations]);

  const toggleRegion = (regionId: string) => {
    setSelectedRegions((prev) =>
      prev.includes(regionId) ? prev.filter((r) => r !== regionId) : [...prev, regionId]
    );
  };

  const filteredDestinations = useMemo(() => {
    const filtered = allDestinations.filter((d) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!d.name.toLowerCase().includes(q) && !d.country.toLowerCase().includes(q)) {
          return false;
        }
      }
      if (selectedRegions.length > 0 && !selectedRegions.includes(d.region)) {
        return false;
      }
      return true;
    });

    const sorted = [...filtered];
    if (sortBy === "alpha") {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "dispatches") {
      sorted.sort((a, b) => (b.articleCount || 0) - (a.articleCount || 0));
    } else {
      // "popular" — admin-featured cities first, then by real article count.
      sorted.sort((a, b) => {
        if (Boolean(b.isPopular) !== Boolean(a.isPopular)) return b.isPopular ? 1 : -1;
        return (b.articleCount || 0) - (a.articleCount || 0);
      });
    }
    return sorted;
  }, [allDestinations, searchQuery, selectedRegions, sortBy]);

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
            <span className="text-slate-800">Destinations</span>
          </nav>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            {/* Left Title & Tagline */}
            <div className="max-w-xl">
              <div className="flex items-center gap-2 mb-2">
                <span className="h-2 w-2 rounded-full bg-[#DC2626] animate-pulse" />
                <span className="text-[11px] font-black uppercase tracking-widest text-[#DC2626]">
                  GLOBAL BUREAUS
                </span>
              </div>
              <h1 className="font-serif text-3xl sm:text-4xl lg:text-[44px] font-black tracking-tight text-[#0B1527]">
                Destinations
              </h1>
              <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
                Explore the latest attraction news and travel updates from the world&apos;s most iconic destinations.
              </p>
            </div>

            {/* Right: Get Destination Alerts Box */}
            <div className="relative rounded-xl border border-rose-100/80 bg-rose-50/40 p-4 sm:p-5 lg:w-[380px] overflow-hidden">
              <div className="absolute right-2 -bottom-4 opacity-15 pointer-events-none">
                <svg className="w-32 h-32 text-rose-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              </div>

              <h3 className="font-sans text-xs font-black uppercase tracking-wider text-[#0B1527]">
                GET DESTINATION ALERTS
              </h3>
              <p className="mt-1 text-[11px] text-slate-500 leading-normal">
                Stay updated on city guides, theme park openings, and travel updates.
              </p>
              <div className="mt-2.5">
                <NewsletterForm source="destinations" variant="light" />
              </div>
            </div>
          </div>
        </Container>
      </div>

      {/* =========================================
          2. MAIN CONTENT WITH SIDEBAR & GRID
      ========================================= */}
      <section className="py-8 sm:py-10">
        <Container>
          {/* Breadcrumbs */}
          <nav className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 mb-6">
            <Link href="/" className="hover:text-slate-900 transition-colors">
              Home
            </Link>
            <span>/</span>
            <span className="text-slate-800">Destinations</span>
          </nav>

          <div className="grid gap-8 lg:grid-cols-12 items-start">
            {/* Left Column (25% / 3 cols): Filters */}
            <div className="lg:col-span-3 flex flex-col gap-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                {/* Search Destinations */}
                <div className="mb-6">
                  <h3 className="font-sans text-xs font-black uppercase tracking-wider text-[#0B1527] mb-2">
                    Search Destinations
                  </h3>
                  <div className="relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search cities or countries..."
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 pr-8 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#DC2626] focus:bg-white focus:outline-none"
                    />
                    <svg
                      className="absolute right-3 top-2.5 h-3.5 w-3.5 text-slate-400"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <circle cx="11" cy="11" r="7" />
                      <path strokeLinecap="round" d="m21 21-4.3-4.3" />
                    </svg>
                  </div>
                </div>

                {/* Filter by Region */}
                <div className="mb-6">
                  <h3 className="font-sans text-xs font-black uppercase tracking-wider text-[#0B1527] mb-2.5">
                    Filter by Region
                  </h3>
                  <div className="space-y-2">
                    {regions.map((r) => (
                      <label key={r.id} className="flex items-center justify-between text-xs text-slate-700 cursor-pointer hover:text-slate-900">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedRegions.includes(r.id)}
                            onChange={() => toggleRegion(r.id)}
                            className="h-3.5 w-3.5 rounded border-slate-300 text-[#DC2626] focus:ring-[#DC2626]"
                          />
                          <span>{r.label}</span>
                        </div>
                        <span className="text-[11px] text-slate-400">{r.count}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Sort By */}
                <div>
                  <h3 className="font-sans text-xs font-black uppercase tracking-wider text-[#0B1527] mb-2">
                    Sort By
                  </h3>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:border-[#DC2626] focus:bg-white focus:outline-none cursor-pointer"
                  >
                    <option value="popular">Most Popular</option>
                    <option value="dispatches">Most Dispatches</option>
                    <option value="alpha">Alphabetical</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Right Column (75% / 9 cols): Destinations Grid */}
            <div className="lg:col-span-9 flex flex-col gap-6">
              {/* Header bar */}
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-widest text-[#DC2626]">
                    {filteredDestinations.length} DESTINATIONS
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <span className="font-semibold">Sort by:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-800 focus:border-[#DC2626] focus:outline-none cursor-pointer"
                  >
                    <option value="popular">Most Popular</option>
                    <option value="dispatches">Most Dispatches</option>
                    <option value="alpha">Alphabetical</option>
                  </select>
                </div>
              </div>

              {/* Grid */}
              {filteredDestinations.length === 0 ? (
                <EmptyState
                  title="No destinations match your filters"
                  description="Try a different search term or clear the region filter."
                />
              ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {filteredDestinations.map((city) => (
                  <div
                    key={city.id}
                    className="group flex flex-col rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-300"
                  >
                    {/* Photo with Overlay */}
                    <div className="relative h-48 w-full overflow-hidden bg-slate-900">
                      {city.heroImage ? (
                        <Image
                          src={city.heroImage}
                          alt={city.heroImageAlt || city.name}
                          fill
                          sizes="(min-width: 1024px) 33vw, 50vw"
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-[#0B1527] text-xs font-semibold text-white/40">
                          No image
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

                      {/* Badges */}
                      <div className="absolute top-3 inset-x-3 flex items-center justify-between">
                        {city.isPopular ? (
                          <span className="rounded-full bg-[#DC2626] px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white shadow-sm flex items-center gap-1">
                            <span>◆</span> POPULAR
                          </span>
                        ) : (
                          <span />
                        )}
                        <span className="rounded-full bg-black/60 backdrop-blur-md px-2.5 py-0.5 text-[10px] font-bold text-white border border-white/10">
                          {city.articleCount ?? 0} {city.articleCount === 1 ? "dispatch" : "dispatches"}
                        </span>
                      </div>

                      {/* City Name & Country on Image */}
                      <div className="absolute bottom-3 left-4 text-white">
                        <h3 className="font-sans text-xl font-black leading-tight text-white group-hover:text-red-200 transition-colors">
                          {city.name}
                        </h3>
                        <p className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                          {city.country}
                        </p>
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="flex flex-1 flex-col p-4 sm:p-5">
                      <p className="text-xs text-slate-600 leading-relaxed line-clamp-3 mb-4">
                        {city.intro || `News and visitor updates from ${city.name}'s landmark attractions, theme parks, and historic venues.`}
                      </p>

                      <div className="mt-auto pt-3 border-t border-slate-100">
                        <Link
                          href={`/cities/${city.slug}`}
                          className="text-xs font-black uppercase tracking-wider text-[#DC2626] flex items-center gap-1 group-hover:translate-x-1 transition-transform"
                        >
                          <span>Explore {city.name}</span>
                          <span aria-hidden="true">→</span>
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              )}
            </div>
          </div>
        </Container>
      </section>

      {/* =========================================
          3. BOTTOM FULL-WIDTH NEWSLETTER STRIP
      ========================================= */}
      <section className="mt-8">
        <Container>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Left Graphic & Text */}
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-2xl shadow-sm">
                📬
              </div>
              <div>
                <h3 className="font-sans text-sm sm:text-base font-black text-[#0B1527]">
                  Stay Updated on Your Favorite Destinations
                </h3>
                <p className="mt-0.5 text-xs text-slate-500 leading-relaxed max-w-lg">
                  Get the latest attraction news, travel tips, and opening updates delivered straight to your inbox.
                </p>
              </div>
            </div>

            {/* Right Form */}
            <div className="w-full md:w-auto">
              <NewsletterForm source="destinations-footer" variant="light" />
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}
