import { WORLD_CITIES } from "./data/worldCities";

// Backs the city/country autocomplete used by Admin's "Add Destination"
// form and the Contributor article editor's "Other" destination field (see
// app/api/geo/cities/route.ts). Flattened once per server instance from the
// bundled dataset rather than re-flattened on every request — this array
// never changes at runtime, so there's nothing to invalidate.
export interface CitySearchResult {
  city: string;
  country: string;
  countryCode: string;
}

let flatCache: CitySearchResult[] | null = null;
function allCities(): CitySearchResult[] {
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

// Ranks city-name-starts-with matches above city-name-contains matches
// above country-name matches (typing "par" should surface Paris before any
// city that merely contains "par" elsewhere, and well before a country
// match) — each bucket alphabetized, deduplicated by definition since the
// source dataset has no duplicate (city, country) pairs, and capped at
// `limit` so the dropdown stays short regardless of how broad the query is.
export function searchCities(query: string, limit = 8): CitySearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const startsWith: CitySearchResult[] = [];
  const contains: CitySearchResult[] = [];
  const countryOnly: CitySearchResult[] = [];

  for (const entry of allCities()) {
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
