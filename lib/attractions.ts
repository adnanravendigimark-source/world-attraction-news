import { sql } from "./db";

// City -> Attraction -> Article. An attraction always belongs to exactly
// one city; its slug is unique within that city (not site-wide), so the
// public URL is /cities/[citySlug]/attractions/[attractionSlug].
export interface Attraction {
  id: string;
  citySlug: string;
  slug: string;
  name: string;
  description: string;
  heroImage: string;
  heroImageAlt: string;
  metaTitle: string;
  metaDescription: string;
  sortOrder: number;
  createdAt: string;
}

function rowToAttraction(row: any): Attraction {
  return {
    id: row.id,
    citySlug: row.city_slug ?? row.city_id,
    slug: row.slug,
    name: row.name,
    description: row.description || "",
    heroImage: row.hero_image || "",
    heroImageAlt: row.hero_image_alt || "",
    metaTitle: row.meta_title || "",
    metaDescription: row.meta_description || "",
    sortOrder: row.sort_order ?? 0,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}

// Everywhere an attraction needs its city context (admin list, article
// editor's attraction picker, public breadcrumbs) without a second query.
export interface AttractionWithCity extends Attraction {
  cityId: string;
  cityName: string;
}

function rowToAttractionWithCity(row: any): AttractionWithCity {
  return {
    ...rowToAttraction(row),
    cityId: row.city_id,
    cityName: row.city_name,
  };
}

const JOIN_SELECT = `
  SELECT at.*, c.name AS city_name, c.slug AS city_slug
  FROM attractions at
  JOIN cities c ON c.id = at.city_id
`;

export async function getAttractions(): Promise<AttractionWithCity[]> {
  try {
    const rows = await sql(`${JOIN_SELECT} ORDER BY c.sort_order ASC, at.sort_order ASC, at.name ASC`, []);
    return rows.map(rowToAttractionWithCity);
  } catch {
    return [];
  }
}

export async function getAttractionsByCityId(cityId: string): Promise<Attraction[]> {
  try {
    const rows = await sql`SELECT * FROM attractions WHERE city_id = ${cityId} ORDER BY sort_order ASC, name ASC`;
    return rows.map(rowToAttraction);
  } catch {
    return [];
  }
}

export async function getAttractionById(id: string): Promise<AttractionWithCity | undefined> {
  const rows = await sql(`${JOIN_SELECT} WHERE at.id = $1 LIMIT 1`, [id]);
  return rows.length ? rowToAttractionWithCity(rows[0]) : undefined;
}

export async function getAttractionBySlug(citySlug: string, attractionSlug: string): Promise<AttractionWithCity | undefined> {
  const rows = await sql(`${JOIN_SELECT} WHERE c.slug = $1 AND at.slug = $2 LIMIT 1`, [citySlug, attractionSlug]);
  return rows.length ? rowToAttractionWithCity(rows[0]) : undefined;
}

// Real per-attraction published-article counts — used on the admin list and
// the public attraction index, same "no fake numbers" pattern as
// getPublishedArticleCountsByCity in lib/articles.ts.
export async function getPublishedArticleCountsByAttraction(): Promise<Record<string, number>> {
  try {
    const rows = await sql`
      SELECT attraction_id, COUNT(*)::int AS count FROM articles
      WHERE status = 'published' AND attraction_id IS NOT NULL
      GROUP BY attraction_id
    `;
    return Object.fromEntries(rows.map((r: any) => [r.attraction_id, r.count]));
  } catch {
    return {};
  }
}

async function slugExistsInCity(cityId: string, slug: string, excludeId?: string): Promise<boolean> {
  const rows = excludeId
    ? await sql`SELECT id FROM attractions WHERE city_id = ${cityId} AND slug = ${slug} AND id != ${excludeId} LIMIT 1`
    : await sql`SELECT id FROM attractions WHERE city_id = ${cityId} AND slug = ${slug} LIMIT 1`;
  return rows.length > 0;
}

export async function generateUniqueAttractionSlug(cityId: string, name: string, excludeId?: string): Promise<string> {
  const base =
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 80) || "attraction";
  let slug = base;
  let i = 2;
  while (await slugExistsInCity(cityId, slug, excludeId)) {
    slug = `${base}-${i}`;
    i++;
  }
  return slug;
}

export async function createAttraction(input: {
  cityId: string;
  name: string;
  description: string;
  heroImage: string;
  heroImageAlt: string;
  metaTitle: string;
  metaDescription: string;
  sortOrder: number;
}): Promise<Attraction> {
  const slug = await generateUniqueAttractionSlug(input.cityId, input.name);
  const rows = await sql`
    INSERT INTO attractions (city_id, slug, name, description, hero_image, hero_image_alt, meta_title, meta_description, sort_order)
    VALUES (${input.cityId}, ${slug}, ${input.name}, ${input.description}, ${input.heroImage}, ${input.heroImageAlt}, ${input.metaTitle}, ${input.metaDescription}, ${input.sortOrder})
    RETURNING *
  `;
  return rowToAttraction(rows[0]);
}

export async function updateAttraction(
  id: string,
  updates: {
    name?: string;
    description?: string;
    heroImage?: string;
    heroImageAlt?: string;
    metaTitle?: string;
    metaDescription?: string;
    sortOrder?: number;
  }
): Promise<Attraction> {
  const current = await sql`SELECT * FROM attractions WHERE id = ${id} LIMIT 1`;
  if (!current.length) throw new Error("Attraction not found.");
  const c = current[0];
  const nextName = updates.name ?? c.name;
  const slug = updates.name && updates.name !== c.name ? await generateUniqueAttractionSlug(c.city_id, nextName, id) : c.slug;
  const rows = await sql`
    UPDATE attractions
    SET name = ${nextName},
        slug = ${slug},
        description = ${updates.description ?? c.description},
        hero_image = ${updates.heroImage ?? c.hero_image},
        hero_image_alt = ${updates.heroImageAlt ?? c.hero_image_alt},
        meta_title = ${updates.metaTitle ?? c.meta_title},
        meta_description = ${updates.metaDescription ?? c.meta_description},
        sort_order = ${updates.sortOrder ?? c.sort_order}
    WHERE id = ${id}
    RETURNING *
  `;
  return rowToAttraction(rows[0]);
}

export async function deleteAttraction(id: string): Promise<void> {
  const articleRows = await sql`SELECT COUNT(*)::int AS count FROM articles WHERE attraction_id = ${id}`;
  const count = articleRows[0]?.count ?? 0;
  if (count > 0) {
    throw new Error(`Can't delete this attraction — ${count} article(s) are still assigned to it. Reassign or remove those articles first.`);
  }
  await sql`DELETE FROM attractions WHERE id = ${id}`;
}
