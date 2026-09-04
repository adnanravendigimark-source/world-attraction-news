// Turns a canonical country display name (e.g. "United States", as returned
// by lib/geo.ts's searchCities()) into the stable URL segment used across
// the site's /destinations/[countrySlug]/... routes. Every city's country
// name comes from the same fixed dataset (lib/data/worldCities.ts), so the
// same country always slugifies to the same value — there's no risk of
// "USA" and "United States" ending up as two different country pages the
// way free-typed country text could previously cause.
export function slugifyCountry(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
