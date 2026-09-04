import { WORLD_CITIES } from "./data/worldCities";

export interface CitySearchResult {
  city: string;
  country: string;
  countryCode: string;
  admin1?: string;
}

let flatCache: CitySearchResult[] | null = null;
function allLocalCities(): CitySearchResult[] {
  if (flatCache) return flatCache;
  const out: CitySearchResult[] = [];
  for (const entry of WORLD_CITIES) {
    for (const city of entry.cities) {
      out.push({ city, country: entry.country, countryCode: entry.code });
    }
  }
  flatCache = out;
  return out;
}

function searchLocalCities(query: string, limit = 10): CitySearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const startsWith: CitySearchResult[] = [];
  const contains: CitySearchResult[] = [];
  const countryOnly: CitySearchResult[] = [];

  for (const entry of allLocalCities()) {
    const cityLower = entry.city.toLowerCase();
    if (cityLower.startsWith(q)) {
      startsWith.push(entry);
    } else if (cityLower.includes(q)) {
      contains.push(entry);
    } else if (entry.country.toLowerCase().includes(q)) {
      countryOnly.push(entry);
    }
  }

  const byName = (a: CitySearchResult, b: CitySearchResult) => a.city.localeCompare(b.city);
  startsWith.sort(byName);
  contains.sort(byName);
  countryOnly.sort(byName);

  return [...startsWith, ...contains, ...countryOnly].slice(0, limit);
}

// Global world city search — connects to Open-Meteo Geocoding API covering
// every city, town, and municipality worldwide (with administrative
// subdivisions like states/provinces), with a resilient fallback to the
// bundled reference dataset if the network is unavailable.
export async function searchCities(query: string, limit = 10): Promise<CitySearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=${Math.max(limit * 2, 20)}&language=en&format=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3500) });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.results) && data.results.length > 0) {
        const seen = new Set<string>();
        const results: CitySearchResult[] = [];

        // Sort: exact matches first, then population, then prefix matches
        const qLower = q.toLowerCase();
        const sorted = [...data.results].sort((a, b) => {
          const aExact = a.name.toLowerCase() === qLower ? 1 : 0;
          const bExact = b.name.toLowerCase() === qLower ? 1 : 0;
          if (aExact !== bExact) return bExact - aExact;

          const aStarts = a.name.toLowerCase().startsWith(qLower) ? 1 : 0;
          const bStarts = b.name.toLowerCase().startsWith(qLower) ? 1 : 0;
          if (aStarts !== bStarts) return bStarts - aStarts;

          return (b.population || 0) - (a.population || 0);
        });

        for (const item of sorted) {
          if (!item.name || !item.country) continue;
          const key = `${item.name.toLowerCase()}|${item.country.toLowerCase()}|${(item.admin1 || "").toLowerCase()}`;
          if (seen.has(key)) continue;
          seen.add(key);

          results.push({
            city: item.name,
            country: item.country,
            countryCode: item.country_code || "",
            admin1: item.admin1 || undefined,
          });

          if (results.length >= limit) break;
        }

        if (results.length > 0) return results;
      }
    }
  } catch {
    // Network failure or timeout — fall back to bundled dataset
  }

  return searchLocalCities(q, limit);
}
