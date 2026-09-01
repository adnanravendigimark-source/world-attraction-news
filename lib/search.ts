import { sql } from "./db";
import type { ArticleWithRelations } from "./articles";
import type { City } from "./cities";
import type { Category } from "./categories";

function rowToArticleWithRelations(row: any): ArticleWithRelations {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    contentHtml: row.content_html,
    cityId: row.city_id,
    categoryId: row.category_id,
    authorId: row.author_id,
    status: row.status,
    score: row.score === null || row.score === undefined ? null : Number(row.score),
    adminFeedback: row.admin_feedback || "",
    image: row.image,
    imageAlt: row.image_alt,
    metaTitle: row.meta_title || "",
    metaDescription: row.meta_description || "",
    focusKeyword: row.focus_keyword || "",
    tags: Array.isArray(row.tags) ? row.tags : [],
    canonicalUrl: row.canonical_url || "",
    wordCount: row.word_count ?? 0,
    readingTimeMinutes: row.reading_time_minutes ?? 0,
    originalityScore: row.originality_score === null || row.originality_score === undefined ? null : Number(row.originality_score),
    originalityFlag: Boolean(row.originality_flag),
    submittedAt: row.submitted_at ? new Date(row.submitted_at).toISOString() : null,
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).toISOString() : null,
    publishedAt: row.published_at ? new Date(row.published_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : "",
    cityName: row.city_name,
    citySlug: row.city_slug,
    categoryName: row.category_name,
    categorySlug: row.category_slug,
    authorName: row.author_name,
    authorEmail: row.author_email,
  };
}

// Real full-text-ish search over genuine database content — no mocked
// results. Matches on title, excerpt, tags, and the plain-text body for
// articles; name/country for cities; name/description for categories.
// ILIKE against a small/medium article table is plenty fast here; if this
// ever needs to scale to a much larger catalog, swap these ILIKE clauses for
// Postgres full-text search (tsvector) without changing this function's
// signature.
export async function searchArticles(query: string, limit = 20): Promise<ArticleWithRelations[]> {
  const q = `%${query}%`;
  try {
    const rows = await sql`
      SELECT a.*, c.name AS city_name, c.slug AS city_slug,
             cat.name AS category_name, cat.slug AS category_slug,
             u.display_name AS author_name, u.email AS author_email
      FROM articles a
      JOIN cities c ON c.id = a.city_id
      LEFT JOIN categories cat ON cat.id = a.category_id
      JOIN users u ON u.id = a.author_id
      WHERE a.status = 'published'
        AND (
          a.title ILIKE ${q}
          OR a.excerpt ILIKE ${q}
          OR a.content_html ILIKE ${q}
          OR array_to_string(a.tags, ' ') ILIKE ${q}
          OR c.name ILIKE ${q}
          OR cat.name ILIKE ${q}
        )
      ORDER BY a.published_at DESC
      LIMIT ${limit}
    `;
    return rows.map(rowToArticleWithRelations);
  } catch {
    return [];
  }
}

export async function searchCities(query: string, limit = 10): Promise<City[]> {
  const q = `%${query}%`;
  try {
    const rows = await sql`
      SELECT * FROM cities WHERE name ILIKE ${q} OR country ILIKE ${q} OR intro ILIKE ${q}
      ORDER BY name ASC LIMIT ${limit}
    `;
    return rows.map((r: any) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      country: r.country,
      heroImage: r.hero_image,
      heroImageAlt: r.hero_image_alt,
      intro: r.intro,
      metaTitle: r.meta_title,
      metaDescription: r.meta_description,
      sortOrder: r.sort_order,
    }));
  } catch {
    return [];
  }
}

export async function searchCategories(query: string, limit = 10): Promise<Category[]> {
  const q = `%${query}%`;
  try {
    const rows = await sql`
      SELECT * FROM categories WHERE name ILIKE ${q} OR description ILIKE ${q}
      ORDER BY name ASC LIMIT ${limit}
    `;
    return rows.map((r: any) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      description: r.description || "",
      sortOrder: r.sort_order,
    }));
  } catch {
    return [];
  }
}

export interface SearchResults {
  articles: ArticleWithRelations[];
  cities: City[];
  categories: Category[];
}

export async function search(query: string): Promise<SearchResults> {
  const trimmed = query.trim();
  if (!trimmed) return { articles: [], cities: [], categories: [] };
  const [articles, cities, categories] = await Promise.all([
    searchArticles(trimmed, 24),
    searchCities(trimmed, 6),
    searchCategories(trimmed, 6),
  ]);
  return { articles, cities, categories };
}
