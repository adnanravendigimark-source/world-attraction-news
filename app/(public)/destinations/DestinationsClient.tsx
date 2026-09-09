"use client";

import { useMemo, useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import Container from "@/components/Container";
import NewsletterForm from "@/components/NewsletterForm";
import EmptyState from "@/components/EmptyState";
import { countryPath } from "@/lib/destinations";
import { slugifyCountry } from "@/lib/countries";
import { WORLD_CITIES } from "@/lib/data/worldCities";

export interface DestinationCity {
  id: string;
  slug: string;
  countrySlug: string;
  name: string;
  country: string;
  region?: string;
  intro?: string;
  heroImage?: string;
  heroImageAlt?: string;
  articleCount?: number;
}

export interface DestinationCountryData {
  id?: string;
  slug: string;
  name: string;
  intro?: string;
  heroImage?: string;
  heroImageAlt?: string;
}

interface DestinationCountryItem {
  slug: string;
  name: string;
  region: string;
  intro: string;
  heroImage: string;
  heroImageAlt: string;
  cities: DestinationCity[];
  cityCount: number;
  totalArticles: number;
}

// Global Country to Region Mapping (covering world countries)
const COUNTRY_TO_REGION: Record<string, string> = {
  // Europe
  "Spain": "Europe", "France": "Europe", "Italy": "Europe", "United Kingdom": "Europe",
  "Netherlands": "Europe", "Germany": "Europe", "Portugal": "Europe", "Greece": "Europe",
  "Austria": "Europe", "Switzerland": "Europe", "Belgium": "Europe", "Ireland": "Europe",
  "Croatia": "Europe", "Czech Republic": "Europe", "Denmark": "Europe", "Finland": "Europe",
  "Hungary": "Europe", "Iceland": "Europe", "Norway": "Europe", "Poland": "Europe",
  "Sweden": "Europe", "Turkey": "Europe", "Albania": "Europe", "Andorra": "Europe",
  "Belarus": "Europe", "Bosnia and Herzegovina": "Europe", "Bulgaria": "Europe",
  "Cyprus": "Europe", "Estonia": "Europe", "Latvia": "Europe", "Liechtenstein": "Europe",
  "Lithuania": "Europe", "Luxembourg": "Europe", "Malta": "Europe", "Moldova": "Europe",
  "Monaco": "Europe", "Montenegro": "Europe", "North Macedonia": "Europe", "Romania": "Europe",
  "Russia": "Europe", "San Marino": "Europe", "Serbia": "Europe", "Slovakia": "Europe",
  "Slovenia": "Europe", "Ukraine": "Europe", "Vatican City": "Europe", "Kosovo": "Europe",

  // Asia
  "Japan": "Asia", "Singapore": "Asia", "United Arab Emirates": "Asia", "China": "Asia",
  "Thailand": "Asia", "South Korea": "Asia", "India": "Asia", "Indonesia": "Asia",
  "Vietnam": "Asia", "Malaysia": "Asia", "Philippines": "Asia", "Taiwan": "Asia",
  "Hong Kong": "Asia", "Macau": "Asia", "Maldives": "Asia", "Qatar": "Asia",
  "Saudi Arabia": "Asia", "Israel": "Asia", "Jordan": "Asia", "Oman": "Asia",
  "Bahrain": "Asia", "Kuwait": "Asia", "Lebanon": "Asia", "Sri Lanka": "Asia",
  "Nepal": "Asia", "Cambodia": "Asia", "Laos": "Asia", "Myanmar": "Asia",
  "Bhutan": "Asia", "Brunei": "Asia", "Kazakhstan": "Asia", "Uzbekistan": "Asia",
  "Azerbaijan": "Asia", "Georgia": "Asia", "Armenia": "Asia", "Mongolia": "Asia",
  "Pakistan": "Asia", "Bangladesh": "Asia", "Iraq": "Asia", "Iran": "Asia",

  // North America
  "United States": "North America", "Canada": "North America", "Mexico": "North America",
  "Costa Rica": "North America", "Panama": "North America", "Dominican Republic": "North America",
  "Jamaica": "North America", "Bahamas": "North America", "Cuba": "North America",
  "Guatemala": "North America", "Belize": "North America", "Barbados": "North America",
  "Puerto Rico": "North America", "Trinidad and Tobago": "North America",
  "Honduras": "North America", "El Salvador": "North America", "Nicaragua": "North America",

  // South America
  "Brazil": "South America", "Argentina": "South America", "Peru": "South America",
  "Chile": "South America", "Colombia": "South America", "Ecuador": "South America",
  "Uruguay": "South America", "Bolivia": "South America", "Paraguay": "South America",
  "Venezuela": "South America", "Guyana": "South America", "Suriname": "South America",

  // Oceania
  "Australia": "Oceania", "New Zealand": "Oceania", "Fiji": "Oceania",
  "French Polynesia": "Oceania", "Samoa": "Oceania", "Papua New Guinea": "Oceania",
  "Guam": "Oceania", "Vanuatu": "Oceania", "New Caledonia": "Oceania",

  // Africa
  "Egypt": "Africa", "Morocco": "Africa", "South Africa": "Africa", "Kenya": "Africa",
  "Tanzania": "Africa", "Mauritius": "Africa", "Seychelles": "Africa", "Tunisia": "Africa",
  "Ghana": "Africa", "Nigeria": "Africa", "Rwanda": "Africa", "Uganda": "Africa",
  "Namibia": "Africa", "Botswana": "Africa", "Zimbabwe": "Africa", "Ethiopia": "Africa",
  "Senegal": "Africa", "Madagascar": "Africa", "Algeria": "Africa", "Cape Verde": "Africa",
};

export function getRegionForCountry(country: string): string {
  if (!country) return "Other";
  return COUNTRY_TO_REGION[country] || "Other";
}

const REGION_ORDER = ["Europe", "Asia", "North America", "South America", "Oceania", "Africa", "Other"];

export default function DestinationsClient({
  dbCities = [],
  dbCountries = [],
}: {
  dbCities?: DestinationCity[];
  dbCountries?: DestinationCountryData[];
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRegion, setSelectedRegion] = useState<string>("all");
  const [selectedCountry, setSelectedCountry] = useState<string>("all");
  const [selectedCity, setSelectedCity] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"dispatches" | "cities" | "alpha">("dispatches");

  // 1. Build unified Country items from database countries and cities
  const allCountryItems = useMemo<DestinationCountryItem[]>(() => {
    const countryMap = new Map<string, DestinationCountryItem>();

    // Seed explicit countries from database
    for (const co of dbCountries) {
      if (!co.name || !co.slug) continue;
      countryMap.set(co.slug, {
        slug: co.slug,
        name: co.name,
        region: getRegionForCountry(co.name),
        intro: co.intro || "",
        heroImage: co.heroImage || "",
        heroImageAlt: co.heroImageAlt || co.name,
        cities: [],
        cityCount: 0,
        totalArticles: 0,
      });
    }

    // Attach cities to their respective countries or synthesize missing country entries
    for (const city of dbCities) {
      const cSlug = city.countrySlug || slugifyCountry(city.country);
      let item = countryMap.get(cSlug);

      if (!item) {
        item = {
          slug: cSlug,
          name: city.country,
          region: getRegionForCountry(city.country),
          intro: "",
          heroImage: "",
          heroImageAlt: city.country,
          cities: [],
          cityCount: 0,
          totalArticles: 0,
        };
        countryMap.set(cSlug, item);
      }

      item.cities.push(city);
      item.cityCount += 1;
      item.totalArticles += (city.articleCount || 0);

      if (!item.heroImage && city.heroImage) {
        item.heroImage = city.heroImage;
        item.heroImageAlt = city.heroImageAlt || item.name;
      }
    }

    return Array.from(countryMap.values()).map((country) => ({
      ...country,
      intro:
        country.intro.trim() ||
        `Explore landmark attractions, theme parks, and visitor guides across ${country.name}. Discover dispatches from our city bureaus.`,
      cities: country.cities.sort((a, b) => (b.articleCount || 0) - (a.articleCount || 0)),
    }));
  }, [dbCities, dbCountries]);

  // 2. Global reverse lookup map for city -> country and country -> region
  const { cityToCountryMap } = useMemo(() => {
    const map = new Map<string, { city: string; country: string; region: string }>();

    // From DB cities first (highest priority)
    for (const c of dbCities) {
      const region = getRegionForCountry(c.country);
      map.set(c.name.toLowerCase(), { city: c.name, country: c.country, region });
      map.set(c.slug.toLowerCase(), { city: c.name, country: c.country, region });
    }

    // From WORLD_CITIES dataset
    for (const entry of WORLD_CITIES) {
      const region = getRegionForCountry(entry.country);
      for (const cityName of entry.cities) {
        const key = cityName.toLowerCase();
        if (!map.has(key)) {
          map.set(key, { city: cityName, country: entry.country, region });
        }
      }
    }

    return { cityToCountryMap: map };
  }, [dbCities]);

  // 3. Dynamic Auto-Detection based on search query
  // Priority: 1. Exact Country -> 2. Country StartsWith -> 3. DB City -> 4. World City
  const detectedGeo = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q || q.length < 2) return null;

    // 1. Exact Country match
    const exactCountry = allCountryItems.find(
      (c) => c.name.toLowerCase() === q || c.slug.toLowerCase() === q
    );
    if (exactCountry) {
      return {
        matchedType: "country" as const,
        cityName: null,
        countryName: exactCountry.name,
        region: exactCountry.region,
      };
    }

    // Country startsWith match (e.g. "spai" -> Spain)
    const startsWithCountry = allCountryItems.find(
      (c) => c.name.toLowerCase().startsWith(q) || c.slug.toLowerCase().startsWith(q)
    );
    if (startsWithCountry) {
      return {
        matchedType: "country" as const,
        cityName: null,
        countryName: startsWithCountry.name,
        region: startsWithCountry.region,
      };
    }

    // Global country list exact match
    for (const [co, reg] of Object.entries(COUNTRY_TO_REGION)) {
      if (co.toLowerCase() === q || co.toLowerCase().startsWith(q)) {
        return {
          matchedType: "country" as const,
          cityName: null,
          countryName: co,
          region: reg,
        };
      }
    }

    // 2. Exact City match from DB or World Cities (e.g. "Bali" -> Indonesia, Asia)
    const directCityMatch = cityToCountryMap.get(q);
    if (directCityMatch) {
      return {
        matchedType: "city" as const,
        cityName: directCityMatch.city,
        countryName: directCityMatch.country,
        region: directCityMatch.region,
      };
    }

    // 3. City startsWith match
    for (const [key, val] of Array.from(cityToCountryMap.entries())) {
      if (key.startsWith(q)) {
        return {
          matchedType: "city" as const,
          cityName: val.city,
          countryName: val.country,
          region: val.region,
        };
      }
    }

    return null;
  }, [searchQuery, allCountryItems, cityToCountryMap]);

  // Synchronize Country and Region when search auto-detects a destination
  // If search query is cleared or removed, auto-reset filters back to "all"
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSelectedCountry("all");
      setSelectedRegion("all");
      setSelectedCity("all");
      return;
    }

    if (detectedGeo) {
      if (detectedGeo.countryName) {
        setSelectedCountry(detectedGeo.countryName);
      }
      if (detectedGeo.region) {
        setSelectedRegion(detectedGeo.region);
      }
      if (detectedGeo.matchedType === "city" && detectedGeo.cityName) {
        const hasDbCity = dbCities.some(
          (c) => c.name.toLowerCase() === detectedGeo.cityName!.toLowerCase()
        );
        if (hasDbCity) {
          setSelectedCity(detectedGeo.cityName);
        } else {
          setSelectedCity("all");
        }
      } else {
        setSelectedCity("all");
      }
    }
  }, [searchQuery, detectedGeo, dbCities]);

  // 4. Available Regions list (computed dynamically from destination data)
  const availableRegions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of allCountryItems) {
      counts.set(c.region, (counts.get(c.region) || 0) + 1);
    }
    return REGION_ORDER.filter((r) => counts.has(r)).map((r) => ({
      id: r,
      label: r,
      count: counts.get(r) || 0,
    }));
  }, [allCountryItems]);

  // 5. Available Countries list (dynamically filtered by Region)
  const availableCountries = useMemo(() => {
    let list = allCountryItems;
    if (selectedRegion !== "all") {
      list = list.filter((c) => c.region === selectedRegion);
    }
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [allCountryItems, selectedRegion]);

  // 6. Available Cities list (dynamically filtered by Country and Region)
  const availableCities = useMemo(() => {
    let list: DestinationCity[] = [];

    if (selectedCountry !== "all") {
      const countryItem = allCountryItems.find(
        (c) => c.name.toLowerCase() === selectedCountry.toLowerCase() || c.slug === selectedCountry
      );
      if (countryItem) {
        list = countryItem.cities;
      }
    } else if (selectedRegion !== "all") {
      const countriesInRegion = allCountryItems.filter((c) => c.region === selectedRegion);
      list = countriesInRegion.flatMap((c) => c.cities);
    } else {
      list = allCountryItems.flatMap((c) => c.cities);
    }

    // Deduplicate by name
    const unique = new Map<string, DestinationCity>();
    for (const city of list) {
      if (!unique.has(city.name)) {
        unique.set(city.name, city);
      }
    }

    return Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [allCountryItems, selectedCountry, selectedRegion]);

  // Handlers
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (!value.trim()) {
      setSelectedRegion("all");
      setSelectedCountry("all");
      setSelectedCity("all");
    }
  };

  const handleRegionChange = (region: string) => {
    setSelectedRegion(region);
    setSelectedCountry("all");
    setSelectedCity("all");
  };

  const handleCountryChange = (countryValue: string) => {
    setSelectedCountry(countryValue);
    setSelectedCity("all");

    if (countryValue !== "all") {
      const countryItem = allCountryItems.find(
        (c) => c.name.toLowerCase() === countryValue.toLowerCase() || c.slug === countryValue
      );
      if (countryItem) {
        setSelectedRegion(countryItem.region);
      }
    }
  };

  const handleCityChange = (cityValue: string) => {
    setSelectedCity(cityValue);

    if (cityValue !== "all") {
      const cityMatch = dbCities.find(
        (c) => c.name.toLowerCase() === cityValue.toLowerCase() || c.slug === cityValue
      );
      if (cityMatch) {
        setSelectedCountry(cityMatch.country);
        setSelectedRegion(getRegionForCountry(cityMatch.country));
      } else {
        const fallback = cityToCountryMap.get(cityValue.toLowerCase());
        if (fallback) {
          setSelectedCountry(fallback.country);
          setSelectedRegion(fallback.region);
        }
      }
    }
  };

  const clearAllFilters = () => {
    setSearchQuery("");
    setSelectedRegion("all");
    setSelectedCountry("all");
    setSelectedCity("all");
    setSortBy("dispatches");
  };

  const hasActiveFilters =
    searchQuery !== "" ||
    selectedRegion !== "all" ||
    selectedCountry !== "all" ||
    selectedCity !== "all";

  // 7. Filtered and Sorted Countries for Main Grid Display
  const filteredCountries = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    const filtered = allCountryItems.filter((country) => {
      // Filter by Region
      if (selectedRegion !== "all" && country.region !== selectedRegion) {
        return false;
      }

      // Filter by Country
      if (selectedCountry !== "all") {
        if (
          country.slug !== selectedCountry &&
          country.name.toLowerCase() !== selectedCountry.toLowerCase()
        ) {
          return false;
        }
      }

      // Filter by City
      if (selectedCity !== "all") {
        const hasCity = country.cities.some(
          (c) => c.name.toLowerCase() === selectedCity.toLowerCase() || c.slug === selectedCity
        );
        if (!hasCity) return false;
      }

      // Filter by Search Query
      if (q) {
        const matchesCountry =
          country.name.toLowerCase().includes(q) ||
          country.slug.toLowerCase().includes(q) ||
          country.intro.toLowerCase().includes(q);
        const matchesCity = country.cities.some(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.slug.toLowerCase().includes(q) ||
            (c.intro || "").toLowerCase().includes(q)
        );
        const matchesDetectedCountry =
          detectedGeo && detectedGeo.countryName.toLowerCase() === country.name.toLowerCase();

        if (!matchesCountry && !matchesCity && !matchesDetectedCountry) return false;
      }

      return true;
    });

    const sorted = [...filtered];
    if (sortBy === "alpha") {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "cities") {
      sorted.sort((a, b) => b.cityCount - a.cityCount || b.totalArticles - a.totalArticles);
    } else {
      // Default: "dispatches"
      sorted.sort((a, b) => b.totalArticles - a.totalArticles || b.cityCount - a.cityCount);
    }

    return sorted;
  }, [allCountryItems, selectedRegion, selectedCountry, selectedCity, searchQuery, detectedGeo, sortBy]);

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
            <span className="text-slate-800">Destinations by Country</span>
          </nav>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            {/* Left Title & Tagline */}
            <div className="max-w-xl">
              <div className="flex items-center gap-2 mb-2">
                <span className="h-2 w-2 rounded-full bg-[#DC2626] animate-pulse" />
                <span className="text-[11px] font-black uppercase tracking-widest text-[#DC2626]">
                  GLOBAL COUNTRY BUREAUS
                </span>
              </div>
              <h1 className="font-serif text-3xl sm:text-4xl lg:text-[44px] font-black tracking-tight text-[#0B1527]">
                Destinations
              </h1>
              <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
                Browse our global destination hubs by country. Select any country to explore all of its city bureaus, theme parks, landmark venues, and latest travel dispatches.
              </p>
            </div>

            {/* Right: Get Destination Alerts Box */}
            <div className="relative rounded-xl border border-rose-100/80 bg-rose-50/40 p-4 sm:p-5 lg:w-[380px] overflow-hidden">
              <div className="absolute right-2 -bottom-4 opacity-15 pointer-events-none">
                <svg className="w-32 h-32 text-rose-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              </div>

              <h3 className="font-sans text-xs font-black uppercase tracking-wider text-[#0B1527]">
                GET DESTINATION ALERTS
              </h3>
              <p className="mt-1 text-[11px] text-slate-500 leading-normal">
                Stay updated on city guides, theme park openings, and travel intelligence.
              </p>
              <div className="mt-2.5">
                <NewsletterForm source="destinations" variant="light" />
              </div>
            </div>
          </div>
        </Container>
      </div>

      {/* =========================================
          2. MAIN CONTENT WITH FILTERS & GRID
      ========================================= */}
      <section className="py-8 sm:py-10">
        <Container>
          <div className="grid gap-8 lg:grid-cols-12 items-start">
            {/* Left Column (3 cols): Filter Stack in Exact Specified Order */}
            <div className="lg:col-span-3 flex flex-col gap-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-5">
                {/* -------------------------------------------
                    FILTER 1: Search Destinations
                ------------------------------------------- */}
                <div>
                  <h3 className="font-sans text-xs font-black uppercase tracking-wider text-[#0B1527] mb-2">
                    SEARCH DESTINATIONS
                  </h3>
                  <div className="relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      placeholder="Search cities or countries..."
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 pr-8 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#DC2626] focus:bg-white focus:outline-none transition-all"
                    />
                    {searchQuery ? (
                      <button
                        type="button"
                        onClick={clearAllFilters}
                        className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-700 text-xs font-bold"
                        title="Clear search"
                      >
                        ✕
                      </button>
                    ) : (
                      <svg
                        className="absolute right-3 top-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <circle cx="11" cy="11" r="7" />
                        <path strokeLinecap="round" d="m21 21-4.3-4.3" />
                      </svg>
                    )}
                  </div>
                </div>

                {/* -------------------------------------------
                    FILTER 2: Filter by Region
                ------------------------------------------- */}
                <div>
                  <h3 className="font-sans text-xs font-black uppercase tracking-wider text-[#0B1527] mb-1.5">
                    FILTER BY REGION
                  </h3>
                  <select
                    value={selectedRegion}
                    onChange={(e) => handleRegionChange(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:border-[#DC2626] focus:bg-white focus:outline-none cursor-pointer transition-all"
                  >
                    <option value="all">All Regions ({allCountryItems.length} Countries)</option>
                    {availableRegions.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label} ({r.count})
                      </option>
                    ))}
                  </select>
                </div>

                {/* -------------------------------------------
                    FILTER 3: Filter by Country
                ------------------------------------------- */}
                <div>
                  <h3 className="font-sans text-xs font-black uppercase tracking-wider text-[#0B1527] mb-1.5">
                    FILTER BY COUNTRY
                  </h3>
                  <select
                    value={selectedCountry}
                    onChange={(e) => handleCountryChange(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:border-[#DC2626] focus:bg-white focus:outline-none cursor-pointer transition-all"
                  >
                    <option value="all">
                      {selectedRegion === "all"
                        ? `All Countries (${availableCountries.length})`
                        : `All in ${selectedRegion} (${availableCountries.length})`}
                    </option>
                    {availableCountries.map((c) => (
                      <option key={c.slug} value={c.name}>
                        {c.name} ({c.cityCount} {c.cityCount === 1 ? "city" : "cities"})
                      </option>
                    ))}
                  </select>
                </div>

                {/* -------------------------------------------
                    FILTER 4: Filter by City
                ------------------------------------------- */}
                <div>
                  <h3 className="font-sans text-xs font-black uppercase tracking-wider text-[#0B1527] mb-1.5">
                    FILTER BY CITY
                  </h3>
                  <select
                    value={selectedCity}
                    onChange={(e) => handleCityChange(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:border-[#DC2626] focus:bg-white focus:outline-none cursor-pointer transition-all"
                  >
                    <option value="all">
                      {selectedCountry !== "all"
                        ? `All Cities in ${selectedCountry} (${availableCities.length})`
                        : selectedRegion !== "all"
                        ? `All Cities in ${selectedRegion} (${availableCities.length})`
                        : `All Cities (${availableCities.length})`}
                    </option>
                    {availableCities.map((city) => (
                      <option key={city.name} value={city.name}>
                        {city.name} ({city.country})
                      </option>
                    ))}
                  </select>
                </div>

                {/* -------------------------------------------
                    SORT BY & RESET
                ------------------------------------------- */}
                <div className="pt-1 border-t border-slate-100">
                  <h3 className="font-sans text-xs font-black uppercase tracking-wider text-[#0B1527] mb-1.5">
                    SORT BY
                  </h3>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as "dispatches" | "cities" | "alpha")}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:border-[#DC2626] focus:bg-white focus:outline-none cursor-pointer"
                  >
                    <option value="dispatches">Most Dispatches</option>
                    <option value="cities">Most Cities</option>
                    <option value="alpha">Alphabetical (A-Z)</option>
                  </select>
                </div>

                {/* Reset Filters Button */}
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="w-full rounded-lg border border-rose-200 bg-rose-50/70 px-3 py-2 text-xs font-bold text-[#DC2626] hover:bg-rose-100 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>Reset All Filters</span>
                    <span>✕</span>
                  </button>
                )}
              </div>
            </div>

            {/* Right Column (9 cols): Country Cards Grid */}
            <div className="lg:col-span-9 flex flex-col gap-6">
              {/* Header bar */}
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-widest text-[#DC2626]">
                    {filteredCountries.length} {filteredCountries.length === 1 ? "DESTINATION" : "DESTINATIONS"}
                  </span>
                  {selectedRegion !== "all" && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                      Region: {selectedRegion}
                    </span>
                  )}
                  {selectedCountry !== "all" && (
                    <span className="rounded-full bg-rose-50 text-[#DC2626] border border-rose-200 px-2 py-0.5 text-[10px] font-bold">
                      Country: {selectedCountry}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <span className="font-semibold">Sort by:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as "dispatches" | "cities" | "alpha")}
                    className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-800 focus:border-[#DC2626] focus:outline-none cursor-pointer"
                  >
                    <option value="dispatches">Most Dispatches</option>
                    <option value="cities">Most Cities</option>
                    <option value="alpha">Alphabetical (A-Z)</option>
                  </select>
                </div>
              </div>

              {/* Countries Grid */}
              {filteredCountries.length === 0 ? (
                <EmptyState
                  title="No countries or destinations match your filters"
                  description="Try searching for a different country name or reset your active filters."
                />
              ) : (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredCountries.map((country) => {
                    return (
                      <div
                        key={country.slug}
                        className="group flex flex-col rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-300"
                      >
                        {/* Country Hero Header Image */}
                        <Link
                          href={countryPath(country.slug)}
                          className="relative aspect-[16/10] w-full block overflow-hidden bg-slate-900 focus:outline-none"
                        >
                          {country.heroImage ? (
                            <Image
                              src={country.heroImage}
                              alt={country.heroImageAlt || country.name}
                              fill
                              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                              className="object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-[#0B1527] text-xs font-semibold text-white/40">
                              No image
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

                          {/* Country Name & Region on Image */}
                          <div className="absolute bottom-3 left-4 text-white">
                            <h3 className="font-sans text-xl font-black leading-tight text-white group-hover:text-red-200 transition-colors">
                              {country.name}
                            </h3>
                            <p className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                              {country.region}
                            </p>
                          </div>
                        </Link>

                        {/* Card Body */}
                        <div className="flex flex-1 flex-col p-4 sm:p-5">
                          <p className="text-xs text-slate-600 leading-relaxed line-clamp-3 mb-4">
                            {country.intro}
                          </p>

                          <div className="mt-auto pt-3 border-t border-slate-100">
                            <Link
                              href={countryPath(country.slug)}
                              className="text-xs font-black uppercase tracking-wider text-[#DC2626] flex items-center gap-1 group-hover:translate-x-1 transition-transform"
                            >
                              <span>Explore {country.name}</span>
                              <span aria-hidden="true">→</span>
                            </Link>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Bottom Newsletter Band */}
          <div className="mt-14 rounded-2xl border border-slate-200 bg-slate-50 p-6 sm:p-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#DC2626] text-white">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-sans text-sm sm:text-base font-black text-[#0B1527]">
                    Stay Updated on Global Destinations
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500 leading-relaxed max-w-lg">
                    Get the latest destination dispatches, theme park intelligence, and attraction travel news delivered straight to your inbox.
                  </p>
                </div>
              </div>
              <div className="md:w-80">
                <NewsletterForm source="destinations_footer" variant="light" />
              </div>
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}
