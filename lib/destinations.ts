// Single source of truth for every "destination" (country/city-scoped)
// public URL — /destinations/[countrySlug]/[citySlug]/... The Phase 3 URL
// restructure moved this whole subtree off /cities/*; every call site that
// used to hand-build a `/cities/${citySlug}/...` template string now goes
// through one of these instead, so there's exactly one place that knows the
// URL shape.
export function countryPath(countrySlug: string): string {
  return `/destinations/${countrySlug}`;
}

export function cityPath(countrySlug: string, citySlug: string): string {
  return `/destinations/${countrySlug}/${citySlug}`;
}

export function articlePath(countrySlug: string, citySlug: string, articleSlug: string): string {
  return `/destinations/${countrySlug}/${citySlug}/${articleSlug}`;
}

export function attractionsPath(countrySlug: string, citySlug: string): string {
  return `/destinations/${countrySlug}/${citySlug}/attractions`;
}

export function attractionPath(countrySlug: string, citySlug: string, attractionSlug: string): string {
  return `/destinations/${countrySlug}/${citySlug}/attractions/${attractionSlug}`;
}
