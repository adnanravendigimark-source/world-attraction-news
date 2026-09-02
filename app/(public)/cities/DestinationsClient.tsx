"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Container from "@/components/Container";

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

const DEFAULT_DESTINATIONS: DestinationCity[] = [
  {
    id: "barcelona",
    slug: "barcelona",
    name: "Barcelona",
    country: "Spain",
    region: "Europe",
    intro:
      "News and visitor updates from Barcelona's landmark attractions, museums, and parks — from Gaudi's Sagrada Familia to Park Güell.",
    heroImage: "https://images.unsplash.com/photo-1583422409516-2895a77efded?auto=format&fit=crop&w=800&q=80",
    articleCount: 28,
    isPopular: true,
  },
  {
    id: "amsterdam",
    slug: "amsterdam",
    name: "Amsterdam",
    country: "Netherlands",
    region: "Europe",
    intro:
      "News and visitor updates from Amsterdam's museums and canal-side attractions — the Anne Frank House, Van Gogh Museum, and historic waterways.",
    heroImage: "https://images.unsplash.com/photo-1534351590666-13e3e96b5017?auto=format&fit=crop&w=800&q=80",
    articleCount: 22,
  },
  {
    id: "paris",
    slug: "paris",
    name: "Paris",
    country: "France",
    region: "Europe",
    intro:
      "News and visitor updates from Paris's landmark attractions — the Eiffel Tower, the Louvre, Disneyland Paris, and historic palaces.",
    heroImage: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=800&q=80",
    articleCount: 20,
  },
  {
    id: "rome",
    slug: "rome",
    name: "Rome",
    country: "Italy",
    region: "Europe",
    intro:
      "News and visitor updates from Rome's ancient sites and museums — the Colosseum, the Roman Forum, Vatican City, and iconic fountains.",
    heroImage: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=800&q=80",
    articleCount: 18,
  },
  {
    id: "london",
    slug: "london",
    name: "London",
    country: "United Kingdom",
    region: "Europe",
    intro:
      "News and visitor updates from London's landmark attractions — the Tower of London, the British Museum, London Eye, and West End theatres.",
    heroImage: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=800&q=80",
    articleCount: 17,
  },
  {
    id: "orlando",
    slug: "orlando",
    name: "Orlando",
    country: "United States",
    region: "North America",
    intro:
      "Theme park capital of the world, home to Walt Disney World, Universal Orlando Resort, Epic Universe, and SeaWorld.",
    heroImage: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=800&q=80",
    articleCount: 34,
    isPopular: true,
  },
  {
    id: "tokyo",
    slug: "tokyo",
    name: "Tokyo",
    country: "Japan",
    region: "Asia",
    intro:
      "Cutting-edge theme parks and cultural attractions including Tokyo Disneyland, Tokyo DisneySea, and Studio Ghibli Museum.",
    heroImage: "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=800&q=80",
    articleCount: 15,
  },
  {
    id: "singapore",
    slug: "singapore",
    name: "Singapore",
    country: "Singapore",
    region: "Asia",
    intro:
      "World-class gardens and entertainment hubs including Gardens by the Bay, Universal Studios Singapore, and Jewel Changi.",
    heroImage: "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?auto=format&fit=crop&w=800&q=80",
    articleCount: 12,
  },
  {
    id: "dubai",
    slug: "dubai",
    name: "Dubai",
    country: "United Arab Emirates",
    region: "Asia",
    intro:
      "Architectural marvels and mega theme parks including Burj Khalifa, Dubai Parks and Resorts, and Museum of the Future.",
    heroImage: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=800&q=80",
    articleCount: 14,
  },
];

const REGIONS = [
  { id: "Europe", label: "Europe", count: 5 },
  { id: "North America", label: "North America", count: 1 },
  { id: "Asia", label: "Asia", count: 3 },
  { id: "South America", label: "South America", count: 0 },
  { id: "Oceania", label: "Oceania", count: 0 },
  { id: "Africa", label: "Africa", count: 0 },
];

export default function DestinationsClient({
  dbCities = [],
}: {
  dbCities?: DestinationCity[];
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState("popular");
  const [subscribed, setSubscribed] = useState(false);

  // Combine db cities with mock items if db has fewer items
  const allDestinations = dbCities.length > 0
    ? dbCities.map((c) => ({
        ...c,
        region: c.region || (c.country === "United States" ? "North America" : c.country === "Japan" || c.country === "Singapore" || c.country === "United Arab Emirates" ? "Asia" : "Europe"),
        articleCount: c.articleCount || 12,
      }))
    : DEFAULT_DESTINATIONS;

  const toggleRegion = (regionId: string) => {
    setSelectedRegions((prev) =>
      prev.includes(regionId) ? prev.filter((r) => r !== regionId) : [...prev, regionId]
    );
  };

  const filteredDestinations = allDestinations.filter((d) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!d.name.toLowerCase().includes(q) && !d.country.toLowerCase().includes(q)) {
        return false;
      }
    }
    if (selectedRegions.length > 0 && d.region) {
      if (!selectedRegions.includes(d.region)) {
        return false;
      }
    }
    return true;
  });

  const totalDispatches = allDestinations.reduce((acc, curr) => acc + (curr.articleCount || 0), 0);

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
              {subscribed ? (
                <div className="mt-2.5 p-1.5 bg-emerald-50 text-emerald-700 text-[11px] font-bold rounded text-center">
                  ✓ Subscribed successfully!
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setSubscribed(true);
                  }}
                  className="mt-2.5 flex gap-1.5"
                >
                  <input
                    type="email"
                    required
                    placeholder="Enter your email"
                    className="flex-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#DC2626] focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="rounded-md bg-[#DC2626] px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#B91C1C] transition-colors shadow-sm"
                  >
                    SUBSCRIBE
                  </button>
                </form>
              )}
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
                    {REGIONS.map((r) => (
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
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {filteredDestinations.map((city) => (
                  <div
                    key={city.id}
                    className="group flex flex-col rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-300"
                  >
                    {/* Photo with Overlay */}
                    <div className="relative h-48 w-full overflow-hidden bg-slate-900">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={city.heroImage || "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=800&q=80"}
                        alt={city.heroImageAlt || city.name}
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
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
                          {city.articleCount || 15} dispatches
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
            {subscribed ? (
              <div className="p-2 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg text-center px-4">
                ✓ Subscribed to destination dispatches!
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setSubscribed(true);
                }}
                className="flex w-full md:w-auto items-center gap-2"
              >
                <input
                  type="email"
                  required
                  placeholder="Enter your email address"
                  className="w-full md:w-72 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#DC2626] focus:bg-white focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-[#DC2626] px-5 py-2.5 text-xs font-black uppercase tracking-wider text-white hover:bg-[#B91C1C] transition-colors shadow-sm shrink-0"
                >
                  SUBSCRIBE
                </button>
              </form>
            )}
          </div>
        </Container>
      </section>
    </div>
  );
}
