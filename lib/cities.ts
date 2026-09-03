import { sql } from "./db";

export interface City {
  id: string;
  slug: string;
  name: string;
  country: string;
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

// Real "popularity" ranking for the homepage's Popular Cities section and
// the /cities index — ordered by published article count (a genuine
// database aggregate), not a fabricated ranking. Cities with zero published
// articles yet still come back (count 0) so a brand-new city isn't hidden.
export async function getCitiesWithArticleCounts(): Promise<(City & { articleCount: number })[]> {
  try {
    const rows = await sql`
      SELECT c.*, COUNT(a.id) FILTER (WHERE a.status = 'published')::int AS article_count
      FROM cities c
      LEFT JOIN articles a ON a.city_id = c.id
      GROUP BY c.id
      ORDER BY c.sort_order ASC, c.name ASC
    `;
    return rows.map((r: any) => ({ ...rowToCity(r), articleCount: r.article_count }));
  } catch {
    return [];
  }
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
  const existing = await getCityBySlug(input.slug);
  if (existing) throw new Error("A city with this URL slug already exists.");
  const rows = await sql`
    INSERT INTO cities (slug, name, country, hero_image, hero_image_alt, intro, meta_title, meta_description, sort_order)
    VALUES (${input.slug}, ${input.name}, ${input.country}, ${input.heroImage}, ${input.heroImageAlt}, ${input.intro}, ${input.metaTitle}, ${input.metaDescription}, ${input.sortOrder})
    RETURNING *
  `;
  return rowToCity(rows[0]);
}

export async function updateCity(id: string, updates: Partial<Omit<City, "id">>): Promise<City> {
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
  const rows = await sql`
    UPDATE cities
    SET slug = ${next.slug}, name = ${next.name}, country = ${next.country},
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
