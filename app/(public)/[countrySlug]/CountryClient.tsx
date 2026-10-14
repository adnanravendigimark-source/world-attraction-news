"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import Container from "@/components/Container";
import EmptyState from "@/components/EmptyState";
import NewsletterForm from "@/components/NewsletterForm";
import ArticleCard from "@/components/ArticleCard";
import type { City } from "@/lib/cities";
import type { Country } from "@/lib/countries";
import type { ArticleWithRelations } from "@/lib/articles";
import { cityPath, countryPath } from "@/lib/destinations";

export default function CountryClient({
  countrySlug,
  countryName,
  countryData,
  cities = [],
  articles = [],
}: {
  countrySlug: string;
  countryName: string;
  countryData?: Country | null;
  cities: (City & { articleCount: number })[];
  articles?: ArticleWithRelations[];
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCitySlug, setSelectedCitySlug] = useState<string>("all");

  const totalDispatches = useMemo(
    () => cities.reduce((sum, c) => sum + (c.articleCount || 0), 0),
    [cities]
  );

  const filteredCities = useMemo(() => {
    return cities.filter((city) => {
      if (selectedCitySlug !== "all" && city.slug !== selectedCitySlug) {
        return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!city.name.toLowerCase().includes(q) && !(city.intro || "").toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [cities, selectedCitySlug, searchQuery]);

  const overviewText =
    countryData?.intro?.trim() ||
    `Explore attraction news, theme park updates, and visitor guides across ${countryName}. From iconic landmarks to hidden cultural venues, discover the latest dispatches from our destination bureaus.`;

  return (
    <div className="bg-white min-h-screen text-ink-900 pb-16">
      {/* =========================================
          1. BREADCRUMBS & HERO HEADER
      ========================================= */}
      <div className="border-b border-ink-100 bg-white pt-5 pb-8">
        <Container>
          <nav className="flex items-center gap-1.5 text-xs font-semibold text-ink-400 mb-4">
            <Link href="/" className="hover:text-ink-900 transition-colors">
              Home
            </Link>
            <span>&gt;</span>
            <Link href="/destinations" className="hover:text-ink-900 transition-colors">
              Destinations
            </Link>
            <span>&gt;</span>
            <span className="text-ink-800">{countryName}</span>
          </nav>

          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 mb-2">
                <span className="h-2 w-2 rounded-full bg-signal animate-pulse" />
                <span className="text-[11px] font-black uppercase tracking-widest text-signal">
                  COUNTRY BUREAU · {countryName.toUpperCase()}
                </span>
              </div>
              <h1 className="font-serif text-3xl sm:text-4xl lg:text-[44px] font-black tracking-tight text-ink-900">
                {countryName}
              </h1>
              <p className="mt-3 text-xs sm:text-sm text-ink-600 leading-relaxed font-medium">
                {overviewText}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-ink-500 font-semibold">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-ink-100 px-2.5 py-1 text-ink-700">
                  📍 {cities.length} {cities.length === 1 ? "City Destination" : "City Destinations"}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-md bg-ink-100 px-2.5 py-1 text-ink-700">
                  📰 {totalDispatches} {totalDispatches === 1 ? "Dispatch" : "Dispatches"}
                </span>
              </div>
            </div>

            <div className="relative rounded-xl border border-rose-100/80 bg-rose-50/40 p-4 sm:p-5 lg:w-[380px] overflow-hidden shrink-0">
              <div className="absolute right-2 -bottom-4 opacity-15 pointer-events-none">
                <svg className="w-32 h-32 text-rose-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              </div>

              <h3 className="font-sans text-xs font-black uppercase tracking-wider text-ink-900">
                GET {countryName.toUpperCase()} ALERTS
              </h3>
              <p className="mt-1 text-[11px] text-ink-500 leading-normal">
                Stay updated on city guides, theme park openings, and travel updates across {countryName}.
              </p>
              <div className="mt-2.5">
                <NewsletterForm source={`country-${countrySlug}`} variant="light" />
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
          <div className="grid gap-8 lg:grid-cols-12 items-start">
            {/* Left Sidebar (3 cols): Filter by Cities of THIS country */}
            <div className="lg:col-span-3 flex flex-col gap-6">
              <div className="rounded-2xl border border-ink-200 bg-white p-5 shadow-sm space-y-6">
                {/* Search cities in country */}
                <div>
                  <h3 className="font-sans text-xs font-black uppercase tracking-wider text-ink-900 mb-2">
                    Search {countryName}
                  </h3>
                  <div className="relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={`Search in ${countryName}...`}
                      className="w-full rounded-lg border border-ink-200 bg-ink-50 px-3 py-2 pr-8 text-xs text-ink-800 placeholder:text-ink-400 focus:border-signal focus:bg-white focus:outline-none"
                    />
                    <svg
                      className="absolute right-3 top-2.5 h-3.5 w-3.5 text-ink-400"
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

                {/* Cities in THIS country only */}
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <h3 className="font-sans text-xs font-black uppercase tracking-wider text-ink-900">
                      Cities in {countryName}
                    </h3>
                    <span className="text-[10px] font-bold text-ink-400">
                      {cities.length}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() => setSelectedCitySlug("all")}
                      className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold text-left transition-colors cursor-pointer ${
                        selectedCitySlug === "all"
                          ? "bg-rose-50 text-signal font-bold"
                          : "text-ink-700 hover:bg-ink-50 hover:text-ink-900"
                      }`}
                    >
                      <span>All {countryName} Cities</span>
                      <span className="text-[11px] text-ink-400">{cities.length}</span>
                    </button>

                    {cities.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedCitySlug(c.slug === selectedCitySlug ? "all" : c.slug)}
                        className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-xs text-left transition-colors cursor-pointer ${
                          selectedCitySlug === c.slug
                            ? "bg-rose-50 text-signal font-bold"
                            : "text-ink-700 hover:bg-ink-50 hover:text-ink-900 font-medium"
                        }`}
                      >
                        <span className="truncate">{c.name}</span>
                        <span className="text-[11px] text-ink-400 shrink-0 ml-2">
                          {c.articleCount}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quick Navigation: All Destinations */}
                <div className="border-t border-ink-100 pt-4">
                  <Link
                    href="/destinations"
                    className="flex items-center gap-1.5 text-xs font-bold text-ink-600 hover:text-signal transition-colors"
                  >
                    <span>← Browse All Countries</span>
                  </Link>
                </div>
              </div>
            </div>

            {/* Right Main Column (9 cols): Cities Grid & Country Articles */}
            <div className="lg:col-span-9 flex flex-col gap-8">
              {/* Filter / Header bar */}
              <div>
                <div className="flex items-center justify-between border-b border-ink-200 pb-3 mb-6">
                  <span className="text-xs font-black uppercase tracking-widest text-signal">
                    {filteredCities.length} {filteredCities.length === 1 ? "CITY" : "CITIES"} IN {countryName.toUpperCase()}
                  </span>
                  {(searchQuery || selectedCitySlug !== "all") && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery("");
                        setSelectedCitySlug("all");
                      }}
                      className="text-xs font-bold text-signal hover:underline"
                    >
                      Reset Filter
                    </button>
                  )}
                </div>

                {filteredCities.length === 0 ? (
                  <EmptyState
                    title={`No cities match your search in ${countryName}`}
                    description="Try searching for a different city name or reset the filter."
                  />
                ) : (
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredCities.map((city) => (
                      <Link
                        key={city.id}
                        href={cityPath(city.countrySlug, city.slug)}
                        className="group flex flex-col rounded-2xl border border-ink-200 bg-white overflow-hidden shadow-sm hover:shadow-md hover:border-ink-300 transition-all duration-300 hover:-translate-y-0.5"
                      >
                        <div className="relative h-48 w-full overflow-hidden bg-ink-900">
                          {city.heroImage ? (
                            <Image
                              src={city.heroImage}
                              alt={city.heroImageAlt || city.name}
                              fill
                              sizes="(min-width: 1024px) 33vw, 50vw"
                              className="object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center bg-ink-900">
                              <span className="font-serif text-xl font-black text-white/40">{city.name}</span>
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/30 to-transparent" />

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
                          <p className="text-xs text-ink-600 leading-relaxed line-clamp-3 mb-4">
                            {city.intro || `News and visitor updates from ${city.name}'s landmark attractions, theme parks, and historic venues.`}
                          </p>
                          <div className="mt-auto pt-3 border-t border-ink-100 flex items-center justify-between">
                            <span className="text-xs font-black uppercase tracking-wider text-signal flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                              <span>Explore {city.name}</span>
                              <span aria-hidden="true">→</span>
                            </span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Latest Dispatches from this Country (if any) */}
              {articles.length > 0 && (
                <div className="mt-4 pt-8 border-t border-ink-200">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <span className="text-xs font-black uppercase tracking-widest text-signal">
                        LATEST REPORTING
                      </span>
                      <h2 className="font-serif text-2xl font-bold text-ink-900 mt-1">
                        Recent Dispatches from {countryName}
                      </h2>
                    </div>
                  </div>

                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {articles.map((article) => (
                      <ArticleCard key={article.id} article={article} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </Container>
      </section>

      {/* =========================================
          3. BOTTOM NEWSLETTER STRIP
      ========================================= */}
      <section className="mt-8">
        <Container>
          <div className="rounded-2xl border border-ink-200 bg-white p-6 sm:p-8 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-2xl shadow-sm">
                📬
              </div>
              <div>
                <h3 className="font-sans text-sm sm:text-base font-black text-ink-900">
                  Stay Updated on {countryName}
                </h3>
                <p className="mt-0.5 text-xs text-ink-500 leading-relaxed max-w-lg">
                  Get breaking attraction news and travel updates delivered to your inbox.
                </p>
              </div>
            </div>
            <div className="w-full md:w-auto">
              <NewsletterForm source={`country-${countrySlug}-footer`} variant="light" />
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}
