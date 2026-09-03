import { sql } from "./db";

export interface Category {
  id: string;
  slug: string;
  name: string;
  description: string;
  sortOrder: number;
}

function rowToCategory(row: any): Category {
  return { id: row.id, slug: row.slug, name: row.name, description: row.description || "", sortOrder: row.sort_order };
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

export async function createCategory(input: {
  slug: string;
  name: string;
  description?: string;
  sortOrder: number;
}): Promise<Category> {
  const existing = await getCategoryBySlug(input.slug);
  if (existing) throw new Error("A category with this URL slug already exists.");
  const rows = await sql`
    INSERT INTO categories (slug, name, description, sort_order)
    VALUES (${input.slug}, ${input.name}, ${input.description || ""}, ${input.sortOrder})
    RETURNING *
  `;
  return rowToCategory(rows[0]);
}

export async function updateCategory(id: string, updates: Partial<Omit<Category, "id">>): Promise<Category> {
  const current = await getCategoryById(id);
  if (!current) throw new Error("Category not found.");
  const next = { ...current, ...updates };
  // Same "check before update" gap as lib/cities.ts's updateCity — without
  // this, editing a category's slug to collide with another category's
  // failed with a raw database unique-violation instead of a clear message.
  if (next.slug !== current.slug) {
    const existing = await getCategoryBySlug(next.slug);
    if (existing && existing.id !== id) throw new Error("A category with this URL slug already exists.");
  }
  const rows = await sql`
    UPDATE categories SET slug = ${next.slug}, name = ${next.name}, description = ${next.description}, sort_order = ${next.sortOrder}
    WHERE id = ${id}
    RETURNING *
  `;
  return rowToCategory(rows[0]);
}

export async function deleteCategory(id: string): Promise<void> {
  // Same "block, don't silently strip" rule as deleteCity/deleteAttraction —
  // this used to silently NULL category_id on every referencing article
  // (including published ones) with no warning at all, the only one of the
  // three taxonomy resources that didn't require reassigning first.
  const articleRows = await sql`SELECT COUNT(*)::int AS count FROM articles WHERE category_id = ${id}`;
  const count = articleRows[0]?.count ?? 0;
  if (count > 0) {
    throw new Error(`Can't delete this category — ${count} article(s) are still assigned to it. Reassign or remove those articles first.`);
  }
  await sql`DELETE FROM categories WHERE id = ${id}`;
}
