// Single source of truth for every "destination" (country/city-scoped)
// public URL — /destinations/[countrySlug]/[citySlug]/... The Phase 3 URL
// restructure moved this whole subtree off /cities/*; every call site that
// used to hand-build a `/cities/${citySlug}/...` template string now goes
// through one of these instead, so there's exactly one place that knows the
// URL shape.
export function countryPath(countrySlug: string): string {
  const cSlug = (countrySlug || "").trim() || "destinations";
  return `/destinations/${cSlug}`;
}

export function cityPath(countrySlug: string, citySlug: string): string {
  const cSlug = (countrySlug || "").trim() || "destinations";
  const c = (citySlug || "").trim() || "city";
  return `/destinations/${cSlug}/${c}`;
}

export function articlePath(countrySlug: string, citySlug: string, articleSlug: string): string {
  const cSlug = (countrySlug || "").trim() || "destinations";
  const c = (citySlug || "").trim() || "city";
  const a = (articleSlug || "").trim() || "article";
  return `/destinations/${cSlug}/${c}/${a}`;
}

export function attractionsPath(countrySlug: string, citySlug: string): string {
  const cSlug = (countrySlug || "").trim() || "destinations";
  const c = (citySlug || "").trim() || "city";
  return `/destinations/${cSlug}/${c}/attractions`;
}

export function attractionPath(countrySlug: string, citySlug: string, attractionSlug: string): string {
  const cSlug = (countrySlug || "").trim() || "destinations";
  const c = (citySlug || "").trim() || "city";
  const a = (attractionSlug || "").trim() || "attraction";
  return `/destinations/${cSlug}/${c}/attractions/${a}`;
}
