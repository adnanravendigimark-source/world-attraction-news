// Single source of truth for every "destination" (country/city-scoped)
// public URL — /[countrySlug]/[citySlug]/... (country and city pages live
// directly off the root; /destinations is the browse/index page only, never
// a prefix for an individual city or country URL). Every call site that
// needs one of these URLs goes through a helper here instead of
// hand-building the template string, so there's exactly one place that
// knows the URL shape. The old /destinations/[country]/[city]/... paths
// (and, before that, /cities/[city]/...) still resolve — see the legacy
// redirect shims at those old route locations — so existing bookmarks and
// search engine listings don't 404.
// "unknown-destination" (not "destinations") is deliberate for the missing
// -slug fallback below — falling back to literally "destinations" would
// make countryPath("") collide with the real /destinations index route.
// In practice every city/country row always has a real slug, so this
// fallback is defensive-only and shouldn't be reachable from real data.
const MISSING_SLUG = "unknown-destination";

export function countryPath(countrySlug: string): string {
  const cSlug = (countrySlug || "").trim() || MISSING_SLUG;
  return `/${cSlug}`;
}

export function cityPath(countrySlug: string, citySlug: string): string {
  const cSlug = (countrySlug || "").trim() || MISSING_SLUG;
  const c = (citySlug || "").trim() || "city";
  return `/${cSlug}/${c}`;
}

export function articlePath(countrySlug: string, citySlug: string, articleSlug: string): string {
  const cSlug = (countrySlug || "").trim() || MISSING_SLUG;
  const c = (citySlug || "").trim() || "city";
  const a = (articleSlug || "").trim() || "article";
  return `/${cSlug}/${c}/${a}`;
}
