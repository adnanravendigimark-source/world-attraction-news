import { sql } from "./db";
import { getFeaturedCategorySlugs, setFeaturedCategorySlugs } from "./settings";

export interface Category {
  id: string;
  slug: string;
  name: string;
  description: string;
  image: string;
  imageAlt: string;
  metaTitle: string;
  metaDescription: string;
  sortOrder: number;
}

function rowToCategory(row: any): Category {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description || "",
    image: row.image || "",
    imageAlt: row.image_alt || "",
    metaTitle: row.meta_title || "",
    metaDescription: row.meta_description || "",
    sortOrder: row.sort_order,
  };
}

export async function getCategories(): Promise<Category[]> {
  try {
    const rows = await sql`SELECT * FROM categories ORDER BY sort_order ASC, name ASC`;
    return rows.map(rowToCategory);
  } catch {
    return [];
  }
}

export async function getCategoryBySlug(slug: string): Promise<Category | undefined> {
  const rows = await sql`SELECT * FROM categories WHERE slug = ${slug} LIMIT 1`;
  return rows.length ? rowToCategory(rows[0]) : undefined;
}

export async function getCategoryById(id: string): Promise<Category | undefined> {
  const rows = await sql`SELECT * FROM categories WHERE id = ${id} LIMIT 1`;
  return rows.length ? rowToCategory(rows[0]) : undefined;
}

// Pure helper mirroring pickFeaturedCities() in lib/cities.ts
export function pickFeaturedCategories(allCategories: Category[], featuredSlugs: string[]): Category[] {
  if (featuredSlugs.length === 0) return allCategories.slice(0, 6);
  const bySlug = new Map(allCategories.map((c) => [c.slug, c]));
  return featuredSlugs.map((slug) => bySlug.get(slug)).filter((c): c is Category => Boolean(c));
}

// Categories for the public navbar's "Categories" dropdown
export async function getFeaturedCategories(): Promise<Category[]> {
  const [allCategories, featuredSlugs] = await Promise.all([getCategories(), getFeaturedCategorySlugs()]);
  return pickFeaturedCategories(allCategories, featuredSlugs);
}

export async function createCategory(input: {
  slug: string;
  name: string;
  description?: string;
  image?: string;
  imageAlt?: string;
  metaTitle?: string;
  metaDescription?: string;
  sortOrder: number;
}): Promise<Category> {
  const existing = await getCategoryBySlug(input.slug);
  if (existing) throw new Error("A category with this URL slug already exists.");
  const rows = await sql`
    INSERT INTO categories (slug, name, description, image, image_alt, meta_title, meta_description, sort_order)
    VALUES (
      ${input.slug},
      ${input.name},
      ${input.description || ""},
      ${input.image || ""},
      ${input.imageAlt || ""},
      ${input.metaTitle || ""},
      ${input.metaDescription || ""},
      ${Number.isFinite(input.sortOrder) ? input.sortOrder : 0}
    )
    RETURNING *
  `;
  return rowToCategory(rows[0]);
}

export async function updateCategory(id: string, updates: Partial<Omit<Category, "id">>): Promise<Category> {
  const current = await getCategoryById(id);
  if (!current) throw new Error("Category not found.");
  const next = { ...current, ...updates };

  if (next.slug !== current.slug) {
    const existing = await getCategoryBySlug(next.slug);
    if (existing && existing.id !== id) throw new Error("A category with this URL slug already exists.");
  }
  const rows = await sql`
    UPDATE categories SET
      slug = ${next.slug},
      name = ${next.name},
      description = ${next.description || ""},
      image = ${next.image || ""},
      image_alt = ${next.imageAlt || ""},
      meta_title = ${next.metaTitle || ""},
      meta_description = ${next.metaDescription || ""},
      sort_order = ${Number.isFinite(next.sortOrder) ? next.sortOrder : 0}
    WHERE id = ${id}
    RETURNING *
  `;

  if (next.slug !== current.slug) {
    const featured = await getFeaturedCategorySlugs();
    if (featured.includes(current.slug)) {
      await setFeaturedCategorySlugs(featured.map((s) => (s === current.slug ? next.slug : s)));
    }
  }

  return rowToCategory(rows[0]);
}

export async function deleteCategory(id: string): Promise<void> {
  const articleRows = await sql`SELECT COUNT(*)::int AS count FROM articles WHERE category_id = ${id}`;
  const count = articleRows[0]?.count ?? 0;
  if (count > 0) {
    throw new Error(`Can't delete this category — ${count} article(s) are still assigned to it. Reassign or remove those articles first.`);
  }
  await sql`DELETE FROM categories WHERE id = ${id}`;

  const [featured, remainingCategories] = await Promise.all([getFeaturedCategorySlugs(), getCategories()]);
  const stillValidSlugs = new Set(remainingCategories.map((c) => c.slug));
  const cleaned = featured.filter((s) => stillValidSlugs.has(s));
  if (cleaned.length !== featured.length) {
    await setFeaturedCategorySlugs(cleaned);
  }
}
