import { sql } from "./db";
import { slugifyCountry } from "./countries";

export interface City {
  id: string;
  slug: string;
  name: string;
  country: string;
  countrySlug: string;
  heroImage: string;
  heroImageAlt: string;
  intro: string;
  metaTitle: string;
  metaDescription: string;
  sortOrder: number;
}

function rowToCity(row: any): City {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    country: row.country,
    countrySlug: row.country_slug || slugifyCountry(row.country),
    heroImage: row.hero_image,
    heroImageAlt: row.hero_image_alt,
    intro: row.intro,
    metaTitle: row.meta_title,
    metaDescription: row.meta_description,
    sortOrder: row.sort_order,
  };
}

export async function getCities(): Promise<City[]> {
  try {
    const rows = await sql`SELECT * FROM cities ORDER BY sort_order ASC, name ASC`;
    return rows.map(rowToCity);
  } catch {
    return [];
  }
}

export async function getCityBySlug(slug: string): Promise<City | undefined> {
  const rows = await sql`SELECT * FROM cities WHERE slug = ${slug} LIMIT 1`;
  return rows.length ? rowToCity(rows[0]) : undefined;
}

export async function getCityById(id: string): Promise<City | undefined> {
  const rows = await sql`SELECT * FROM cities WHERE id = ${id} LIMIT 1`;
  return rows.length ? rowToCity(rows[0]) : undefined;
}

// Every city belonging to a given /[countrySlug] country hub page, real
// article counts included so the hub can show "X dispatches" per city
// without a second round trip per card.
export async function getCitiesByCountrySlug(countrySlug: string): Promise<(City & { articleCount: number })[]> {
  try {
    const rows = await sql`
      SELECT c.*, COUNT(a.id) FILTER (WHERE a.status = 'published')::int AS article_count
      FROM cities c
      LEFT JOIN articles a ON a.city_id = c.id
      WHERE c.country_slug = ${countrySlug}
      GROUP BY c.id
      ORDER BY c.sort_order ASC, c.name ASC
    `;
    return rows.map((r: any) => ({ ...rowToCity(r), articleCount: r.article_count }));
  } catch {
    return [];
  }
}

// One representative (country, countrySlug) pair per distinct country in
// use, for building the "Browse by Country" list on /destinations without
// a second, separate countries table — the canonical country name and its
// slug both come from the same fixed dataset every city's country field is
// drawn from (see lib/data/worldCities.ts), so grouping by country_slug
// here is exactly as reliable as a real countries table would be, without
// the extra join.
export async function getCountriesInUse(): Promise<{ country: string; countrySlug: string; cityCount: number }[]> {
  try {
    const rows = await sql`
      SELECT country, country_slug, COUNT(*)::int AS city_count
      FROM cities
      GROUP BY country, country_slug
      ORDER BY country ASC
    `;
    return rows.map((r: any) => ({ country: r.country, countrySlug: r.country_slug, cityCount: r.city_count }));
  } catch {
    return [];
  }
}

// Real "popularity" ranking for the homepage's Popular Destinations section
// and the /destinations index — ordered by published article count (a genuine
// database aggregate), not a fabricated ranking. Cities with zero published
// articles yet still come back (count 0) so a brand-new city isn't hidden,
// they just sort to the back. (This ORDER BY previously sorted by
// sort_order/name only, contradicting this function's own name and this
// comment — /destinations' client already re-sorts by articleCount itself so it
// wasn't visibly broken there, but the homepage reads this order directly.)
export async function getCitiesWithArticleCounts(): Promise<(City & { articleCount: number })[]> {
  try {
    const rows = await sql`
      SELECT c.*, COUNT(a.id) FILTER (WHERE a.status = 'published')::int AS article_count
      FROM cities c
      LEFT JOIN articles a ON a.city_id = c.id
      GROUP BY c.id
      ORDER BY article_count DESC, c.sort_order ASC, c.name ASC
    `;
    return rows.map((r: any) => ({ ...rowToCity(r), articleCount: r.article_count }));
  } catch {
    return [];
  }
}

// Case-insensitive exact match on (name, country) — a real de-dup guard
// distinct from the slug-uniqueness check below. Two admin submissions (or
// an admin submission plus a contributor's "Other" destination — see
// resolveOrCreateCity() below) can independently produce different slugs
// for what is actually the same real city ("paris" vs "paris-2"); this is
// what stops that from creating a duplicate row instead of just re-using
// the existing one.
export async function findCityByNameAndCountry(name: string, country: string): Promise<City | undefined> {
  const rows = await sql`
    SELECT * FROM cities
    WHERE lower(name) = lower(${name}) AND lower(country) = lower(${country})
    LIMIT 1
  `;
  return rows.length ? rowToCity(rows[0]) : undefined;
}

// Slugifies a city name and appends a numeric suffix until it's unique
// site-wide (city slugs are UNIQUE across the whole table, not scoped per
// country) — the same "-2, -3, ..." pattern generateUniqueSlug() in
// lib/articles.ts and generateUniqueAttractionSlug() in lib/attractions.ts
// already use for their own tables.
export async function generateUniqueCitySlug(name: string): Promise<string> {
  const base =
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 80) || "city";
  let slug = base;
  let i = 2;
  while (await getCityBySlug(slug)) {
    slug = `${base}-${i}`;
    i++;
  }
  return slug;
}

// Used by the contributor "Other" destination flow (see
// app/api/dashboard/cities/resolve/route.ts): a contributor picks a city via
// the same CityAutocomplete/worldCities dataset the admin Add Destination
// form uses, but a contributor isn't allowed to freely create/edit
// destinations the way an admin's Cities manager can — this is the one
// narrow, safe city-write a contributor's own flow is allowed to trigger.
// Reuses an existing city row whenever one already matches (name, country)
// so picking "Paris, France" from two different contributors' articles
// converges on the same city rather than each minting its own duplicate row
// with a "-2" slug; only creates a new row for a genuinely new destination.
// New rows get minimal metadata (empty hero image/intro/SEO fields, default
// sort order) — an admin can enrich them later from the Cities manager,
// exactly like a fresh admin-added destination.
export async function resolveOrCreateCity(name: string, country: string): Promise<City> {
  const existing = await findCityByNameAndCountry(name, country);
  if (existing) return existing;
  const slug = await generateUniqueCitySlug(name);
  return createCity({
    slug,
    name,
    country,
    heroImage: "",
    heroImageAlt: "",
    intro: "",
    metaTitle: "",
    metaDescription: "",
    sortOrder: 0,
  });
}

export async function createCity(input: {
  slug: string;
  name: string;
  country: string;
  heroImage: string;
  heroImageAlt: string;
  intro: string;
  metaTitle: string;
  metaDescription: string;
  sortOrder: number;
}): Promise<City> {
  const existingSlug = await getCityBySlug(input.slug);
  if (existingSlug) throw new Error("A city with this URL slug already exists.");
  const existingCity = await findCityByNameAndCountry(input.name, input.country);
  if (existingCity) {
    throw new Error(`${input.name}, ${input.country} is already a destination (see "${existingCity.name}").`);
  }
  const countrySlug = slugifyCountry(input.country);
  const rows = await sql`
    INSERT INTO cities (slug, name, country, country_slug, hero_image, hero_image_alt, intro, meta_title, meta_description, sort_order)
    VALUES (${input.slug}, ${input.name}, ${input.country}, ${countrySlug}, ${input.heroImage}, ${input.heroImageAlt}, ${input.intro}, ${input.metaTitle}, ${input.metaDescription}, ${input.sortOrder})
    RETURNING *
  `;
  return rowToCity(rows[0]);
}

export async function updateCity(id: string, updates: Partial<Omit<City, "id" | "countrySlug">>): Promise<City> {
  const current = await getCityById(id);
  if (!current) throw new Error("City not found.");
  const next = { ...current, ...updates };
  // createCity checks this; updateCity previously didn't, so editing a
  // city's slug to collide with another city's would fail with a raw,
  // unfriendly database unique-violation instead of the same clear message
  // create gives.
  if (next.slug !== current.slug) {
    const existing = await getCityBySlug(next.slug);
    if (existing && existing.id !== id) throw new Error("A city with this URL slug already exists.");
  }
  if (next.name !== current.name || next.country !== current.country) {
    const existingCity = await findCityByNameAndCountry(next.name, next.country);
    if (existingCity && existingCity.id !== id) {
      throw new Error(`${next.name}, ${next.country} is already a destination (see "${existingCity.name}").`);
    }
  }
  const countrySlug = slugifyCountry(next.country);
  const rows = await sql`
    UPDATE cities
    SET slug = ${next.slug}, name = ${next.name}, country = ${next.country}, country_slug = ${countrySlug},
        hero_image = ${next.heroImage}, hero_image_alt = ${next.heroImageAlt},
        intro = ${next.intro}, meta_title = ${next.metaTitle}, meta_description = ${next.metaDescription},
        sort_order = ${next.sortOrder}
    WHERE id = ${id}
    RETURNING *
  `;
  return rowToCity(rows[0]);
}

export async function deleteCity(id: string): Promise<void> {
  const articleRows = await sql`SELECT COUNT(*)::int AS count FROM articles WHERE city_id = ${id}`;
  const articleCount = articleRows[0]?.count ?? 0;
  if (articleCount > 0) {
    throw new Error(
      `Can't delete this city — ${articleCount} article(s) are still assigned to it. Reassign or remove those articles first.`
    );
  }
  const userRows = await sql`SELECT COUNT(*)::int AS count FROM users WHERE city_id = ${id}`;
  const userCount = userRows[0]?.count ?? 0;
  if (userCount > 0) {
    throw new Error(
      `Can't delete this city — ${userCount} contributor account(s) are still assigned to it. Reassign them first.`
    );
  }
  await sql`DELETE FROM cities WHERE id = ${id}`;
}
