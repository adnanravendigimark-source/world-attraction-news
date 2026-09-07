import { sql } from "./db";

export interface Country {
  id: string;
  slug: string;
  name: string;
  intro: string;
  heroImage: string;
  heroImageAlt: string;
  metaTitle: string;
  metaDescription: string;
  createdAt?: string;
  updatedAt?: string;
}

// Turns a canonical country display name (e.g. "United States") into the stable
// URL segment used across the site's /[countrySlug]/... routes (see lib/destinations.ts).
export function slugifyCountry(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function rowToCountry(row: any): Country {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    intro: row.intro || "",
    heroImage: row.hero_image || "",
    heroImageAlt: row.hero_image_alt || "",
    metaTitle: row.meta_title || "",
    metaDescription: row.meta_description || "",
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
  };
}

let tableEnsured = false;
async function ensureCountriesTable() {
  if (tableEnsured) return;
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS countries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL UNIQUE,
        intro TEXT NOT NULL DEFAULT '',
        hero_image TEXT NOT NULL DEFAULT '',
        hero_image_alt TEXT NOT NULL DEFAULT '',
        meta_title TEXT NOT NULL DEFAULT '',
        meta_description TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    tableEnsured = true;
  } catch (e) {
    console.error("Failed to ensure countries table:", e);
  }
}

export async function getCountryBySlug(slug: string): Promise<Country | undefined> {
  await ensureCountriesTable();
  try {
    const rows = await sql`SELECT * FROM countries WHERE slug = ${slug} LIMIT 1`;
    return rows.length ? rowToCountry(rows[0]) : undefined;
  } catch {
    return undefined;
  }
}

export async function getAllCountries(): Promise<Country[]> {
  await ensureCountriesTable();
  try {
    const rows = await sql`SELECT * FROM countries ORDER BY name ASC`;
    return rows.map(rowToCountry);
  } catch {
    return [];
  }
}

export async function upsertCountry(data: {
  name: string;
  slug?: string;
  intro?: string;
  heroImage?: string;
  heroImageAlt?: string;
  metaTitle?: string;
  metaDescription?: string;
}): Promise<Country> {
  await ensureCountriesTable();
  const slug = data.slug ? data.slug.trim().toLowerCase() : slugifyCountry(data.name);
  const name = data.name.trim();
  const intro = data.intro ?? "";
  const heroImage = data.heroImage ?? "";
  const heroImageAlt = data.heroImageAlt ?? "";
  const metaTitle = data.metaTitle ?? "";
  const metaDescription = data.metaDescription ?? "";

  const rows = await sql`
    INSERT INTO countries (slug, name, intro, hero_image, hero_image_alt, meta_title, meta_description, updated_at)
    VALUES (${slug}, ${name}, ${intro}, ${heroImage}, ${heroImageAlt}, ${metaTitle}, ${metaDescription}, now())
    ON CONFLICT (slug) DO UPDATE SET
      name = EXCLUDED.name,
      intro = EXCLUDED.intro,
      hero_image = EXCLUDED.hero_image,
      hero_image_alt = EXCLUDED.hero_image_alt,
      meta_title = EXCLUDED.meta_title,
      meta_description = EXCLUDED.meta_description,
      updated_at = now()
    RETURNING *
  `;

  return rowToCountry(rows[0]);
}
