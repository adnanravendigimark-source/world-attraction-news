import { getAllCountries } from "./countries";
import { getCountriesInUse } from "./cities";

export interface CountryHub {
  slug: string;
  name: string;
  updatedAt?: string;
}

// The definitive list of "real" country pages — everywhere else in this
// codebase that needs to know "which countries actually have a live page"
// should go through this, not query `countries` or `cities` directly.
//
// A country page is genuinely reachable (see app/(public)/[countrySlug]/
// page.tsx's own existence check: `if (!cities.length && !country)
// notFound()`) the moment EITHER of these is true:
//   1. At least one city is assigned to it (getCountriesInUse(), derived
//      from the `cities` table) — this is how most countries come to
//      exist; nobody has to separately "create" a country first.
//   2. An admin has opened its Country Hub editor and saved SEO content
//      for it (getAllCountries(), the `countries` table) — possible even
//      before any city has been assigned, so a hub with 0 cities yet still
//      counts.
//
// Both lib/indexing.ts's getIndexingOverview() and lib/sitemaps.ts's
// getCountrySitemapUrls() previously queried getAllCountries() alone,
// which silently dropped any country that only exists via #1 — undercounting
// real country pages in both the Indexing admin list and the sitemap. This
// function is the fix: the union of both sources, deduped by slug.
export async function getCountryHubs(): Promise<CountryHub[]> {
  const [inUse, explicit] = await Promise.all([
    getCountriesInUse().catch(() => []),
    getAllCountries().catch(() => []),
  ]);

  const bySlug = new Map<string, CountryHub>();
  for (const c of inUse) {
    bySlug.set(c.countrySlug, { slug: c.countrySlug, name: c.country });
  }
  for (const c of explicit) {
    const existing = bySlug.get(c.slug);
    bySlug.set(c.slug, {
      slug: c.slug,
      // The countries-table row's own name is the more deliberately-set
      // one (an admin typed it into the Country Hub editor) — prefer it,
      // falling back to whatever cities-derived name was found.
      name: c.name || existing?.name || c.slug,
      updatedAt: c.updatedAt,
    });
  }

  return Array.from(bySlug.values()).sort((a, b) => a.name.localeCompare(b.name));
}
