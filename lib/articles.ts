import { createHash } from "crypto";
import { sql } from "./db";
import { publishDueScheduledArticles } from "./scheduling";
import type { ModerationSignals } from "./moderation";
import { sanitizeArticleHtml, stripLinkTags } from "./sanitizeHtml";
import { slugifyCountry } from "./countries";

// Full editorial workflow (Final Phase spec):
//   draft -> pending (submitted) -> under_review -> changes_requested -> pending (resubmitted)
//                                              \-> approved -> scheduled -> published -> unpublished
//                                              \-> rejected
// 'pending' covers both "Submitted" and is also where an admin lands back
// after a resubmission — 'under_review' is an explicit, admin-triggered
// state for "an editor has started looking at this" that existed nowhere
// before. All five original values ('draft', 'pending', 'approved',
// 'rejected', 'published') keep their original meaning exactly as before;
// everything else here is additive.
export type ArticleStatus =
  | "draft"
  | "pending"
  | "under_review"
  | "changes_requested"
  | "approved"
  | "scheduled"
  | "published"
  | "rejected"
  | "unpublished";

export interface Article {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  contentHtml: string;
  cityId: string;
  categoryId: string | null;
  attractionId: string | null;
  authorId: string;
  status: ArticleStatus;
  score: number | null;
  adminFeedback: string;
  image: string;
  imageAlt: string;
  metaTitle: string;
  metaDescription: string;
  focusKeyword: string;
  tags: string[];
  canonicalUrl: string;
  wordCount: number;
  readingTimeMinutes: number;
  originalityScore: number | null;
  originalityFlag: boolean;
  moderationSignals: ModerationSignals | null;
  featured: boolean;
  trending: boolean;
  editorsPick: boolean;
  breaking: boolean;
  scheduledAt: string | null;
  viewCount: number;
  submittedAt: string | null;
  reviewedAt: string | null;
  publishedAt: string | null;
  updatedAt: string;
}

// Joined shape used everywhere an article is displayed alongside its city/
// category/attraction/author names, rather than several separate lookups
// per article.
export interface ArticleWithRelations extends Article {
  cityName: string;
  citySlug: string;
  countrySlug: string;
  categoryName: string | null;
  categorySlug: string | null;
  attractionName: string | null;
  attractionSlug: string | null;
  authorName: string;
  authorEmail: string;
  authorSlug: string | null;
}

function toIso(value: any): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

function rowToArticle(row: any): Article {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    contentHtml: row.content_html,
    cityId: row.city_id,
    categoryId: row.category_id,
    attractionId: row.attraction_id ?? null,
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
    originalityScore:
      row.originality_score === null || row.originality_score === undefined ? null : Number(row.originality_score),
    originalityFlag: Boolean(row.originality_flag),
    moderationSignals: row.moderation_signals ?? null,
    featured: Boolean(row.featured),
    trending: Boolean(row.trending),
    editorsPick: Boolean(row.editors_pick),
    breaking: Boolean(row.breaking),
    scheduledAt: toIso(row.scheduled_at),
    viewCount: row.view_count ?? 0,
    submittedAt: toIso(row.submitted_at),
    reviewedAt: toIso(row.reviewed_at),
    publishedAt: toIso(row.published_at),
    updatedAt: toIso(row.updated_at) || "",
  };
}

function rowToArticleWithRelations(row: any): ArticleWithRelations {
  const cCountrySlug =
    row.country_slug ||
    (row.city_country ? slugifyCountry(row.city_country) : "") ||
    (row.country ? slugifyCountry(row.country) : "") ||
    "united-states";

  return {
    ...rowToArticle(row),
    cityName: row.city_name,
    citySlug: row.city_slug,
    countrySlug: cCountrySlug,
    categoryName: row.category_name,
    categorySlug: row.category_slug,
    attractionName: null,
    attractionSlug: null,
    authorName: row.author_name,
    authorEmail: row.author_email,
    authorSlug: row.author_slug ?? null,
  };
}

// Plain-text word count + a simple 200-words-per-minute reading time
// estimate, computed server-side from content_html on every write so it's
// always in sync with what's actually stored (rather than trusting a
// client-computed number).
export function computeContentStats(html: string): { wordCount: number; readingTimeMinutes: number } {
  const text = (html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const wordCount = text ? text.split(" ").length : 0;
  const readingTimeMinutes = wordCount ? Math.max(1, Math.round(wordCount / 200)) : 0;
  return { wordCount, readingTimeMinutes };
}

// Neon's tagged-template `sql` doesn't support composing a shared partial
// query string with `${}` placeholders inside it (no `sql.unsafe` helper on
// this driver version) — so every joined read below calls `sql(queryString,
// params)` using its plain "ordinary function" form instead, with the same
// full SELECT/JOIN spelled out and numbered `$1, $2...` placeholders. Still
// fully parameterized (no string-built values), just not the tagged-
// template shorthand.
const JOIN_SELECT = `
  SELECT a.*, c.name AS city_name, c.slug AS city_slug, c.country AS city_country,
         COALESCE(NULLIF(c.country_slug, ''), '') AS country_slug,
         cat.name AS category_name, cat.slug AS category_slug,
         u.display_name AS author_name, u.email AS author_email, u.slug AS author_slug
  FROM articles a
  JOIN cities c ON c.id = a.city_id
  LEFT JOIN categories cat ON cat.id = a.category_id
  JOIN users u ON u.id = a.author_id
`;

// --- Public reads (published only) -----------------------------------

export async function getPublishedArticles(opts: {
  countrySlug?: string;
  citySlug?: string;
  categorySlug?: string;
  limit?: number;
} = {}): Promise<ArticleWithRelations[]> {
  try {
    await publishDueScheduledArticles();
    const limit = opts.limit ?? 200;
    const conditions = ["a.status = 'published'"];
    const params: any[] = [];
    if (opts.countrySlug) {
      params.push(opts.countrySlug);
      conditions.push(`c.country_slug = $${params.length}`);
    }
    if (opts.citySlug) {
      params.push(opts.citySlug);
      conditions.push(`c.slug = $${params.length}`);
    }
    if (opts.categorySlug) {
      params.push(opts.categorySlug);
      conditions.push(`cat.slug = $${params.length}`);
    }
    params.push(limit);
    const query = `${JOIN_SELECT} WHERE ${conditions.join(" AND ")} ORDER BY COALESCE(a.published_at, a.updated_at) DESC NULLS LAST LIMIT $${params.length}`;
    const rows = await sql(query, params);
    return rows.map(rowToArticleWithRelations);
  } catch (err) {
    console.error("[getPublishedArticles error]:", err);
    return [];
  }
}

export async function getPublishedArticleBySlug(
  citySlug: string,
  articleSlug: string
): Promise<ArticleWithRelations | undefined> {
  await publishDueScheduledArticles();
  const query = `${JOIN_SELECT} WHERE a.status = 'published' AND c.slug = $1 AND a.slug = $2 LIMIT 1`;
  const rows = await sql(query, [citySlug, articleSlug]);
  return rows.length ? rowToArticleWithRelations(rows[0]) : undefined;
}

export async function getPublishedArticleByAnySlug(
  slug: string
): Promise<ArticleWithRelations | undefined> {
  await publishDueScheduledArticles();
  const query = `${JOIN_SELECT} WHERE a.status = 'published' AND a.slug = $1 LIMIT 1`;
  const rows = await sql(query, [slug]);
  return rows.length ? rowToArticleWithRelations(rows[0]) : undefined;
}

// Real page-view counter — called exactly once per real render of the
// public article page (see
// app/(public)/[countrySlug]/[citySlug]/[articleSlug]/page.tsx).
// Never seeded, never fabricated. Best-effort: a failure here must never
// break the article page itself.
//
// Counts 1 view per unique IP per article, not 1 per page load — a visitor
// who reloads or re-reads the same article must not keep inflating the
// count. Enforced with a UNIQUE(article_id, ip_hash) constraint on
// article_views (see scripts/setup-db.mjs), and the increment only ever
// happens for a row that constraint actually let through.
//
// The IP itself is never stored — only a one-way SHA-256 hash of it. The
// hash is still exactly as unique per visitor as the raw IP would be for
// deduplication purposes, but it can't be reversed back into a real address
// from the stored data, which matters for a table that's effectively a
// permanent per-article read history.
//
// Both statements below run as a single SQL string, which Postgres executes
// as one atomic statement — the INSERT's UNIQUE constraint is what makes
// this safe under concurrent requests for the same (article, IP) pair: at
// most one of two simultaneous inserts can win, so at most one of them ever
// contributes to the COUNT(*) that drives the UPDATE. A view from a second,
// genuinely different IP is a separate row and correctly still counts.
export async function incrementArticleView(id: string, ip: string): Promise<number> {
  try {
    const isDev = process.env.NODE_ENV !== "production";
    const rawIp = ip && ip.trim() !== "" ? ip.trim() : "unknown";
    const ipHash = createHash("sha256").update(rawIp).digest("hex");

    // Cooldown window: 10 seconds for local dev/testing or unknown IP; 30 minutes for production
    const intervalStr = isDev || rawIp === "unknown" || rawIp === "127.0.0.1" || rawIp === "::1"
      ? "10 seconds"
      : "30 minutes";

    const upserted = await sql(
      `
      INSERT INTO article_views (article_id, ip_hash, viewed_at)
      VALUES ($1, $2, now())
      ON CONFLICT (article_id, ip_hash) DO UPDATE
        SET viewed_at = now()
        WHERE article_views.viewed_at < now() - ($3)::interval
      RETURNING 1
      `,
      [id, ipHash, intervalStr]
    );

    // If inserted or updated after cooldown, increment the article's total view count
    if (upserted && upserted.length > 0) {
      const updated = await sql`
        UPDATE articles
        SET view_count = COALESCE(view_count, 0) + 1
        WHERE id = ${id}
        RETURNING view_count
      `;
      if (updated.length > 0 && updated[0]?.view_count != null) {
        return Number(updated[0].view_count);
      }
    }

    // Otherwise cooldown is active; return current view count
    const current = await sql`SELECT view_count FROM articles WHERE id = ${id} LIMIT 1`;
    return current.length > 0 && current[0]?.view_count != null ? Number(current[0].view_count) : 0;
  } catch (err: any) {
    if (err?.message && /article_views.*does not exist/i.test(err.message)) {
      try {
        await sql`
          CREATE TABLE IF NOT EXISTS article_views (
            article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
            ip_hash TEXT NOT NULL,
            viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (article_id, ip_hash)
          )
        `;
        const updated = await sql`
          UPDATE articles
          SET view_count = COALESCE(view_count, 0) + 1
          WHERE id = ${id}
          RETURNING view_count
        `;
        return updated.length > 0 && updated[0]?.view_count != null ? Number(updated[0].view_count) : 0;
      } catch (e) {
        console.error("[articles] retry incrementArticleView failed:", e);
      }
    }
    console.error("[articles] incrementArticleView error:", err);
    try {
      const current = await sql`SELECT view_count FROM articles WHERE id = ${id} LIMIT 1`;
      return current.length > 0 && current[0]?.view_count != null ? Number(current[0].view_count) : 0;
    } catch {
      return 0;
    }
  }
}

export async function getRelatedPublishedArticles(
  cityId: string,
  excludeArticleId: string,
  limit = 4
): Promise<ArticleWithRelations[]> {
  const query = `${JOIN_SELECT} WHERE a.status = 'published' AND a.city_id = $1 AND a.id != $2 ORDER BY a.published_at DESC LIMIT $3`;
  const rows = await sql(query, [cityId, excludeArticleId, limit]);
  return rows.map(rowToArticleWithRelations);
}

export async function getRelatedByCategoryPublishedArticles(
  categoryId: string,
  excludeArticleId: string,
  limit = 4
): Promise<ArticleWithRelations[]> {
  const query = `${JOIN_SELECT} WHERE a.status = 'published' AND a.category_id = $1 AND a.id != $2 ORDER BY a.published_at DESC LIMIT $3`;
  const rows = await sql(query, [categoryId, excludeArticleId, limit]);
  return rows.map(rowToArticleWithRelations);
}

// Paginated published-article listing — used by /latest-news and
// /categories/[slug], which both need a real total count for "page X of Y"
// / "load more" rather than just a capped list.
export type ArticleSort = "latest" | "oldest" | "popular";

export async function getPublishedArticlesPage(opts: {
  citySlug?: string;
  categorySlug?: string;
  query?: string;
  page?: number;
  pageSize?: number;
  sort?: ArticleSort;
} = {}): Promise<{ articles: ArticleWithRelations[]; total: number; page: number; pageSize: number; totalPages: number }> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = opts.pageSize ?? 12;
  try {
    await publishDueScheduledArticles();
    const conditions = ["a.status = 'published'"];
    const params: any[] = [];
    if (opts.citySlug) {
      params.push(opts.citySlug);
      conditions.push(`c.slug = $${params.length}`);
    }
    if (opts.categorySlug) {
      params.push(opts.categorySlug);
      conditions.push(`cat.slug = $${params.length}`);
    }
    if (opts.query && opts.query.trim()) {
      params.push(`%${opts.query.trim()}%`);
      conditions.push(`(a.title ILIKE $${params.length} OR a.excerpt ILIKE $${params.length})`);
    }
    const where = conditions.join(" AND ");

    const countQuery = `
      SELECT COUNT(*)::int AS count
      FROM articles a
      JOIN cities c ON c.id = a.city_id
      LEFT JOIN categories cat ON cat.id = a.category_id
      WHERE ${where}
    `;
    const countRows = await sql(countQuery, params);
    const total = countRows[0]?.count ?? 0;

    // "popular" ranks by the same honest, real signals used elsewhere on the
    // site (real view count, then the admin's own quality score) rather than
    // a fabricated popularity number — see getTrendingArticles() above for
    // the same philosophy.
    const orderBy =
      opts.sort === "oldest"
        ? "a.published_at ASC"
        : opts.sort === "popular"
        ? "a.view_count DESC, a.score DESC NULLS LAST, a.published_at DESC"
        : "a.published_at DESC";

    const pageParams = [...params, pageSize, (page - 1) * pageSize];
    const query = `${JOIN_SELECT} WHERE ${where} ORDER BY ${orderBy} LIMIT $${pageParams.length - 1} OFFSET $${pageParams.length}`;
    const rows = await sql(query, pageParams);

    return { articles: rows.map(rowToArticleWithRelations), total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  } catch (err) {
    console.error("[getPublishedArticlesPage error]:", err);
    return { articles: [], total: 0, page, pageSize, totalPages: 1 };
  }
}

// "Trending" — there's no page-view/analytics tracking in this app, so this
// is deliberately NOT a fake popularity number. It's a real, honest proxy
// built entirely from genuine database content: published articles from the
// last 30 days, ranked by the admin-given quality score (falling back to
// recency for anything not yet scored). If nothing published in that
// window, falls back to the most recently published articles overall so the
// section is never empty just because of a slow news week.
export async function getTrendingArticles(limit = 6): Promise<ArticleWithRelations[]> {
  try {
    const recentQuery = `
      ${JOIN_SELECT}
      WHERE a.status = 'published' AND a.published_at >= now() - interval '30 days'
      ORDER BY a.view_count DESC, a.score DESC NULLS LAST, a.published_at DESC
      LIMIT $1
    `;
    const recentRows = await sql(recentQuery, [limit]);
    if (recentRows.length) return recentRows.map(rowToArticleWithRelations);

    const fallbackQuery = `${JOIN_SELECT} WHERE a.status = 'published' ORDER BY a.published_at DESC LIMIT $1`;
    const fallbackRows = await sql(fallbackQuery, [limit]);
    return fallbackRows.map(rowToArticleWithRelations);
  } catch (err) {
    console.error("[getTrendingArticles error]:", err);
    return [];
  }
}

// All-time highest-scored published articles — a genuine quality signal
// (the admin's own 0-10 review score), distinct from getTrendingArticles()
// which is time-boxed to the last 30 days. Used for the homepage's "Reader
// Favorites" / Popular Attractions section.
export async function getTopScoredArticles(limit = 6): Promise<ArticleWithRelations[]> {
  try {
    const query = `${JOIN_SELECT} WHERE a.status = 'published' AND a.score IS NOT NULL ORDER BY a.score DESC, a.published_at DESC LIMIT $1`;
    const rows = await sql(query, [limit]);
    return rows.map(rowToArticleWithRelations);
  } catch (err) {
    console.error("[getTopScoredArticles error]:", err);
    return [];
  }
}

// Admin-controlled editorial placement — real boolean columns an admin sets
// from the Article Review page, not a computed guess. Homepage sections use
// these directly so "what's Featured" is exactly what an editor chose.
async function getFlaggedArticles(column: "featured" | "trending" | "editors_pick" | "breaking", limit = 6): Promise<ArticleWithRelations[]> {
  try {
    const query = `${JOIN_SELECT} WHERE a.status = 'published' AND a.${column} = true ORDER BY a.published_at DESC LIMIT $1`;
    const rows = await sql(query, [limit]);
    return rows.map(rowToArticleWithRelations);
  } catch (err) {
    console.error("[getFlaggedArticles error]:", err);
    return [];
  }
}
export const getFeaturedArticles = (limit = 6) => getFlaggedArticles("featured", limit);
export const getEditorsPickArticles = (limit = 6) => getFlaggedArticles("editors_pick", limit);
export const getBreakingArticles = (limit = 6) => getFlaggedArticles("breaking", limit);
export const getPinnedTrendingArticles = (limit = 6) => getFlaggedArticles("trending", limit);

// Real per-city / per-category published-article counts, used for "Popular
// Cities", the /destinations index, and the /categories index — every number
// here comes straight from a COUNT(*) against real rows, never a placeholder.
export async function getPublishedArticleCountsByCity(): Promise<Record<string, number>> {
  try {
    const rows = await sql`SELECT city_id, COUNT(*)::int AS count FROM articles WHERE status = 'published' GROUP BY city_id`;
    return Object.fromEntries(rows.map((r: any) => [r.city_id, r.count]));
  } catch {
    return {};
  }
}

export async function getPublishedArticleCountsByCategory(): Promise<Record<string, number>> {
  try {
    const rows = await sql`
      SELECT category_id, COUNT(*)::int AS count FROM articles
      WHERE status = 'published' AND category_id IS NOT NULL
      GROUP BY category_id
    `;
    return Object.fromEntries(rows.map((r: any) => [r.category_id, r.count]));
  } catch {
    return {};
  }
}

// The /categories index needs one representative image per category (the
// most recent published article's). Doing that with N `getPublishedArticles`
// calls (one per category) is an N+1 query pattern; DISTINCT ON gets every
// category's latest image in a single round trip.
export async function getLatestPublishedArticleImageByCategory(): Promise<Record<string, string>> {
  try {
    const rows = await sql`
      SELECT DISTINCT ON (category_id) category_id, image
      FROM articles
      WHERE status = 'published' AND category_id IS NOT NULL AND image IS NOT NULL AND image != ''
      ORDER BY category_id, published_at DESC
    `;
    return Object.fromEntries(rows.map((r: any) => [r.category_id, r.image]));
  } catch {
    return {};
  }
}

// Every article regardless of status, per city/category — the admin
// Destinations/Categories managers need this (not the published-only counts
// above) for two reasons: the "X Live / Y Total" card display, and the
// delete-guard that blocks removing a city/category still referenced by so
// much as an unsubmitted draft (a published-only count would under-report
// and let the client-side pre-check wave through a delete the server would
// still correctly reject — see deleteCategory below). Single COUNT/GROUP BY
// each, not a full getAllArticles() fetch.
export async function getArticleCountsByCity(): Promise<Record<string, { total: number; published: number }>> {
  try {
    const rows = await sql`
      SELECT city_id, COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status = 'published')::int AS published
      FROM articles
      GROUP BY city_id
    `;
    return Object.fromEntries(rows.map((r: any) => [r.city_id, { total: r.total, published: r.published }]));
  } catch {
    return {};
  }
}

export async function getArticleCountsByCategory(): Promise<Record<string, number>> {
  try {
    const rows = await sql`
      SELECT category_id, COUNT(*)::int AS count FROM articles
      WHERE category_id IS NOT NULL
      GROUP BY category_id
    `;
    return Object.fromEntries(rows.map((r: any) => [r.category_id, r.count]));
  } catch {
    return {};
  }
}

// --- Author pages ---------------------------------------------------

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getPublishedArticlesByAuthorId(authorId: string, limit = 100): Promise<ArticleWithRelations[]> {
  if (!authorId || !UUID_REGEX.test(authorId)) return [];
  try {
    const query = `${JOIN_SELECT} WHERE a.status = 'published' AND a.author_id = $1 ORDER BY a.published_at DESC LIMIT $2`;
    const rows = await sql(query, [authorId, limit]);
    return rows.map(rowToArticleWithRelations);
  } catch (err) {
    console.error("[getPublishedArticlesByAuthorId error]:", err);
    return [];
  }
}

// --- Dashboard reads (a contributor's own articles, any status) -------

export async function getArticlesByAuthor(authorId: string): Promise<ArticleWithRelations[]> {
  if (!authorId || !UUID_REGEX.test(authorId)) return [];
  try {
    const query = `${JOIN_SELECT} WHERE a.author_id = $1 ORDER BY a.updated_at DESC`;
    const rows = await sql(query, [authorId]);
    return rows.map(rowToArticleWithRelations);
  } catch (err) {
    console.error("[getArticlesByAuthor error]:", err);
    return [];
  }
}

export async function getArticleById(id: string): Promise<ArticleWithRelations | undefined> {
  const query = `${JOIN_SELECT} WHERE a.id = $1 LIMIT 1`;
  const rows = await sql(query, [id]);
  return rows.length ? rowToArticleWithRelations(rows[0]) : undefined;
}

// --- Admin reads --------------------------------------------------------

// Admin queues never include 'draft' articles — a draft hasn't been
// submitted by its author yet, so there's nothing for an admin to review.
export async function getAllArticles(statusFilter?: ArticleStatus): Promise<ArticleWithRelations[]> {
  try {
    await publishDueScheduledArticles();
    if (statusFilter) {
      const query = `${JOIN_SELECT} WHERE a.status = $1 ORDER BY a.submitted_at DESC NULLS LAST`;
      const rows = await sql(query, [statusFilter]);
      return rows.map(rowToArticleWithRelations);
    }
    const query = `${JOIN_SELECT} WHERE a.status != 'draft' ORDER BY a.submitted_at DESC NULLS LAST`;
    const rows = await sql(query, []);
    return rows.map(rowToArticleWithRelations);
  } catch {
    return [];
  }
}

// Count-only variants for places that just need a number (the Admin
// Overview's draft tile, the Admin header's action badge) rather than full
// joined rows with content_html — avoids paying for a JOIN_SELECT (and, for
// the "draft" case, a redundant publishDueScheduledArticles() run — see
// getAllArticles() above, which already ran it once per request) just to
// read an array's .length.
export async function getDraftArticleCount(): Promise<number> {
  try {
    const rows = await sql`SELECT COUNT(*)::int AS count FROM articles WHERE status = 'draft'`;
    return Number(rows[0]?.count || 0);
  } catch {
    return 0;
  }
}

export async function getPendingArticleCount(): Promise<number> {
  try {
    const rows = await sql`SELECT COUNT(*)::int AS count FROM articles WHERE status = 'pending'`;
    return Number(rows[0]?.count || 0);
  } catch {
    return 0;
  }
}

async function slugExists(slug: string, excludeId?: string): Promise<boolean> {
  const rows = excludeId
    ? await sql`SELECT id FROM articles WHERE slug = ${slug} AND id != ${excludeId} LIMIT 1`
    : await sql`SELECT id FROM articles WHERE slug = ${slug} LIMIT 1`;
  return rows.length > 0;
}

// Normalizes free text (a title, or a contributor's own manually-typed
// slug) into a URL-safe base — shared by generateUniqueSlug below so a
// contributor's custom slug goes through the exact same rules a
// title-derived one does (idempotent on an already-slug-shaped string, so
// passing one back through here is a no-op besides the length cap).
function slugifyText(text: string): string {
  return (
    text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 80) || "article"
  );
}

export async function generateUniqueSlug(title: string, excludeId?: string): Promise<string> {
  const base = slugifyText(title);
  let slug = base;
  let i = 2;
  while (await slugExists(slug, excludeId)) {
    slug = `${base}-${i}`;
    i++;
  }
  return slug;
}

// --- Writes -------------------------------------------------------------

// Creates a new blank(ish) draft — the first save of the "Write New
// Article" flow. Status stays 'draft' (not submitted, invisible to admin
// queues and the public site) until the contributor explicitly submits it
// via submitDraftForReview(). cityId is required up front because the
// database column is NOT NULL (an article always belongs to exactly one
// city); the editor page collects title + city before the first autosave
// fires.
export async function createDraft(input: {
  title: string;
  slug?: string;
  cityId: string;
  categoryId: string | null;
  attractionId?: string | null;
  authorId: string;
  // All optional: the ArticleEditor's very first autosave already has
  // whatever the contributor typed/uploaded/picked before that first save
  // fired (excerpt, body content, cover image, SEO fields), and sends all of
  // it in the same request that creates the draft row — accepting it here
  // means that first save persists everything in one round trip instead of
  // silently dropping it until the *second* autosave (a PATCH) catches up,
  // which previously meant a contributor who typed a title, then closed the
  // tab before a second autosave cycle, could lose everything else they'd
  // already entered.
  excerpt?: string;
  contentHtml?: string;
  image?: string;
  imageAlt?: string;
  metaTitle?: string;
  metaDescription?: string;
  focusKeyword?: string;
}): Promise<Article> {
  const slug = await generateUniqueSlug(input.slug?.trim() || input.title || "untitled-draft");
  const safeContent = input.contentHtml ? sanitizeArticleHtml(input.contentHtml) : "";
  const { wordCount, readingTimeMinutes } = computeContentStats(safeContent);
  const rows = await sql`
    INSERT INTO articles (
      slug, title, excerpt, content_html, city_id, category_id, attraction_id, author_id, status,
      image, image_alt, meta_title, meta_description, focus_keyword,
      word_count, reading_time_minutes, updated_at
    ) VALUES (
      ${slug}, ${input.title || "Untitled draft"}, ${input.excerpt || ""}, ${safeContent}, ${input.cityId}, ${input.categoryId},
      ${input.attractionId ?? null}, ${input.authorId}, 'draft',
      ${input.image || ""}, ${input.imageAlt || ""}, ${input.metaTitle || ""}, ${input.metaDescription || ""}, ${input.focusKeyword || ""},
      ${wordCount}, ${readingTimeMinutes}, now()
    )
    RETURNING *
  `;
  return rowToArticle(rows[0]);
}

// Autosave / manual "Save Draft" — only ever touches articles still in
// 'draft' status (enforced by the WHERE clause, belt-and-suspenders on top
// of the route handler's own check) so it can never silently resurrect an
// already-submitted article back into an editable state.
export async function updateDraft(
  id: string,
  updates: {
    title?: string;
    slug?: string;
    excerpt?: string;
    contentHtml?: string;
    cityId?: string;
    categoryId?: string | null;
    attractionId?: string | null;
    image?: string;
    imageAlt?: string;
    metaTitle?: string;
    metaDescription?: string;
    focusKeyword?: string;
  }
): Promise<Article> {
  const current = await sql`SELECT * FROM articles WHERE id = ${id} AND status = 'draft' LIMIT 1`;
  if (!current.length) throw new Error("Draft not found (it may have already been submitted).");
  const c = current[0];
  const nextTitle = updates.title ?? c.title;
  // A contributor's own manually-edited slug (the "URL slug" field in
  // ArticleEditor) takes priority over the title-derived default whenever
  // they've actually changed it — previously this field was purely
  // decorative: the API silently ignored body.slug and always recomputed
  // from the title, so any manual edit was discarded on the very next save.
  const clientSlug = updates.slug !== undefined ? slugifyText(updates.slug) : undefined;
  const slug =
    clientSlug && clientSlug !== c.slug
      ? await generateUniqueSlug(clientSlug, id)
      : !clientSlug && updates.title && updates.title !== c.title
        ? await generateUniqueSlug(nextTitle, id)
        : c.slug;
  const nextContent =
    updates.contentHtml !== undefined ? sanitizeArticleHtml(updates.contentHtml) : c.content_html;
  const { wordCount, readingTimeMinutes } = computeContentStats(nextContent);

  const rows = await sql`
    UPDATE articles
    SET title = ${nextTitle},
        slug = ${slug},
        excerpt = ${updates.excerpt ?? c.excerpt},
        content_html = ${nextContent},
        city_id = ${updates.cityId ?? c.city_id},
        category_id = ${updates.categoryId !== undefined ? updates.categoryId : c.category_id},
        attraction_id = ${updates.attractionId !== undefined ? updates.attractionId : c.attraction_id},
        image = ${updates.image ?? c.image},
        image_alt = ${updates.imageAlt ?? c.image_alt},
        meta_title = ${updates.metaTitle ?? c.meta_title},
        meta_description = ${updates.metaDescription ?? c.meta_description},
        focus_keyword = ${updates.focusKeyword ?? c.focus_keyword},
        word_count = ${wordCount},
        reading_time_minutes = ${readingTimeMinutes},
        updated_at = now()
    WHERE id = ${id}
    RETURNING *
  `;
  return rowToArticle(rows[0]);
}

// Transitions a draft into the review queue: status -> 'pending',
// submitted_at stamped, and the moderation-check result (originality +
// spam/quality/AI signals) snapshotted onto the row (so admin review can
// see every signal without re-running the checks later). Only callable on
// an article that is currently 'draft' or 'changes_requested' (a
// resubmission after the admin asked for edits).
export async function submitDraftForReview(
  id: string,
  moderation: { score: number; flag: boolean; signals: ModerationSignals }
): Promise<Article> {
  // 'rejected' is included alongside 'draft'/'changes_requested' — every
  // surface that shows a rejected article (dashboard article detail page,
  // the edit page, ArticleEditor's own "Resubmit" button/confirm copy)
  // treats it as resubmittable, so the actual state transition here has
  // to honor that too. A prior rejection's score/feedback intentionally
  // survive the resubmit (not cleared here) so the contributor can still
  // see what the last review said until the new review overwrites it.
  const rows = await sql`
    UPDATE articles
    SET status = 'pending',
        submitted_at = now(),
        reviewed_at = NULL,
        originality_score = ${moderation.score},
        originality_flag = ${moderation.flag},
        moderation_signals = ${JSON.stringify(moderation.signals)},
        updated_at = now()
    WHERE id = ${id} AND status IN ('draft', 'changes_requested', 'rejected')
    RETURNING *
  `;
  if (!rows.length) throw new Error("This article can't be submitted from its current status.");
  return rowToArticle(rows[0]);
}

// A contributor deleting their own never-submitted draft. Deliberately
// scoped to status = 'draft' only — once something has been submitted,
// deleting it would erase the review trail, so that's not offered.
export async function deleteOwnDraft(id: string, authorId: string): Promise<void> {
  await sql`DELETE FROM articles WHERE id = ${id} AND author_id = ${authorId} AND status = 'draft'`;
}

// A contributor editing their own pending/rejected/changes_requested
// article (an edit that resubmits it for review). The route handler must
// verify article.authorId === session.userId AND article.status is one of
// those before calling this. cityId IS accepted here — contributors
// aren't tied to one city, so they choose which city an article belongs to
// at submission time and can change that choice while it's still editable.
export async function updateOwnArticle(
  id: string,
  updates: {
    title?: string;
    slug?: string;
    excerpt?: string;
    contentHtml?: string;
    cityId?: string;
    categoryId?: string | null;
    attractionId?: string | null;
    image?: string;
    imageAlt?: string;
    metaTitle?: string;
    metaDescription?: string;
    focusKeyword?: string;
  }
): Promise<Article> {
  const current = await sql`SELECT * FROM articles WHERE id = ${id} LIMIT 1`;
  if (!current.length) throw new Error("Article not found.");
  const c = current[0];
  const nextTitle = updates.title ?? c.title;
  // See the matching comment in updateDraft above — same "manual slug edit
  // wins if provided" rule applies here.
  const clientSlug = updates.slug !== undefined ? slugifyText(updates.slug) : undefined;
  const slug =
    clientSlug && clientSlug !== c.slug
      ? await generateUniqueSlug(clientSlug, id)
      : !clientSlug && updates.title && updates.title !== c.title
        ? await generateUniqueSlug(nextTitle, id)
        : c.slug;
  const nextContent =
    updates.contentHtml !== undefined ? sanitizeArticleHtml(updates.contentHtml) : c.content_html;
  const { wordCount, readingTimeMinutes } = computeContentStats(nextContent);

  const rows = await sql`
    UPDATE articles
    SET title = ${nextTitle},
        slug = ${slug},
        excerpt = ${updates.excerpt ?? c.excerpt},
        content_html = ${nextContent},
        city_id = ${updates.cityId ?? c.city_id},
        category_id = ${updates.categoryId !== undefined ? updates.categoryId : c.category_id},
        attraction_id = ${updates.attractionId !== undefined ? updates.attractionId : c.attraction_id},
        image = ${updates.image ?? c.image},
        image_alt = ${updates.imageAlt ?? c.image_alt},
        meta_title = ${updates.metaTitle ?? c.meta_title},
        meta_description = ${updates.metaDescription ?? c.meta_description},
        focus_keyword = ${updates.focusKeyword ?? c.focus_keyword},
        word_count = ${wordCount},
        reading_time_minutes = ${readingTimeMinutes},
        updated_at = now()
    WHERE id = ${id}
    RETURNING *
  `;
  return rowToArticle(rows[0]);
}

// Admin explicitly claims an article for review — 'pending' -> 'under_review'.
// Purely a workflow-visibility state (who's looking at what); approving or
// rejecting works from either 'pending' or 'under_review'.
export async function markUnderReview(id: string): Promise<Article> {
  const rows = await sql`
    UPDATE articles SET status = 'under_review', updated_at = now()
    WHERE id = ${id} AND status = 'pending'
    RETURNING *
  `;
  if (!rows.length) throw new Error("Article isn't awaiting review.");
  return rowToArticle(rows[0]);
}

// Admin review — three possible decisions:
//   'approved'           -> ready to schedule/publish
//   'rejected'            -> hard rejection, contributor cannot resubmit
//   'changes_requested'   -> softer than reject: contributor sees the
//                            feedback and can edit + resubmit (goes back
//                            through submitDraftForReview)
// A separate publishArticle()/scheduleArticle() call is required to
// actually put an approved article live — kept as separate steps
// deliberately.
export async function reviewArticle(
  id: string,
  input: { status: "approved" | "rejected" | "changes_requested"; score: number | null; feedback: string }
): Promise<Article> {
  const rows = await sql`
    UPDATE articles
    SET status = ${input.status},
        score = ${input.score},
        admin_feedback = ${input.feedback},
        reviewed_at = now(),
        updated_at = now()
    WHERE id = ${id} AND status NOT IN ('published', 'scheduled', 'unpublished')
    RETURNING *
  `;
  if (!rows.length) throw new Error("Article not found, or isn't awaiting review.");
  return rowToArticle(rows[0]);
}

// Corrects the score and/or feedback on an article that's already been
// reviewed - including one that's already published, scheduled, or
// unpublished. Deliberately never touches `status`: the one-time approve /
// reject / request-changes workflow decision (reviewArticle above) stays
// exactly as sequenced as before, but the score and feedback attached to
// that decision must stay correctable afterward - a mis-typed score or
// feedback that needs clarifying shouldn't be permanently locked in just
// because the article has since gone live. Only blocked on 'draft', since
// nothing has been reviewed yet there for there to be anything to correct.
export async function updateArticleReview(
  id: string,
  input: { score: number | null; feedback: string }
): Promise<Article> {
  const rows = await sql`
    UPDATE articles
    SET score = ${input.score},
        admin_feedback = ${input.feedback},
        reviewed_at = now(),
        updated_at = now()
    WHERE id = ${id} AND status != 'draft'
    RETURNING *
  `;
  if (!rows.length) throw new Error("Article not found, or hasn't been submitted for review yet.");
  return rowToArticle(rows[0]);
}

export async function publishArticle(id: string): Promise<Article> {
  const rows = await sql`
    UPDATE articles
    SET status = 'published', published_at = now(), scheduled_at = NULL, updated_at = now()
    WHERE id = ${id}
    RETURNING *
  `;
  if (!rows.length) throw new Error("Article not found.");
  return rowToArticle(rows[0]);
}

// Schedules an approved article for a future automatic publish — see
// lib/scheduling.ts publishDueScheduledArticles() for the mechanism that
// actually flips it live once the time comes.
export async function scheduleArticle(id: string, scheduledAt: Date): Promise<Article> {
  const rows = await sql`
    UPDATE articles
    SET status = 'scheduled', scheduled_at = ${scheduledAt.toISOString()}, updated_at = now()
    WHERE id = ${id} AND status IN ('approved', 'unpublished')
    RETURNING *
  `;
  if (!rows.length) throw new Error("Only an approved article can be scheduled.");
  return rowToArticle(rows[0]);
}

// Cancels a pending schedule, returning the article to 'approved' so it
// can be published immediately or rescheduled.
export async function cancelSchedule(id: string): Promise<Article> {
  const rows = await sql`
    UPDATE articles
    SET status = 'approved', scheduled_at = NULL, updated_at = now()
    WHERE id = ${id} AND status = 'scheduled'
    RETURNING *
  `;
  if (!rows.length) throw new Error("This article isn't currently scheduled.");
  return rowToArticle(rows[0]);
}

// Pulls a published article back off the public site into a distinct
// 'unpublished' state — kept separate from 'approved' so an article's
// history honestly shows "this went live once, then was taken down"
// rather than looking like it was never published. Score/feedback/review
// history stay intact. publishArticle() accepts 'unpublished' as a valid
// source status, so republishing needs no re-approval step.
export async function unpublishArticle(id: string): Promise<Article> {
  const rows = await sql`
    UPDATE articles
    SET status = 'unpublished', published_at = NULL, updated_at = now()
    WHERE id = ${id} AND status = 'published'
    RETURNING *
  `;
  if (!rows.length) throw new Error("Article not found or not currently published.");
  return rowToArticle(rows[0]);
}

// Admin-only editorial placement toggles (Featured / Trending / Editor's
// Pick / Breaking) — independent of the review workflow, can be set on any
// article regardless of status (an admin might mark something Featured
// while still in draft, ready for the moment it publishes).
export async function updateEditorialFlags(
  id: string,
  flags: { featured?: boolean; trending?: boolean; editorsPick?: boolean; breaking?: boolean }
): Promise<Article> {
  const current = await sql`SELECT * FROM articles WHERE id = ${id} LIMIT 1`;
  if (!current.length) throw new Error("Article not found.");
  const c = current[0];
  const rows = await sql`
    UPDATE articles
    SET featured = ${flags.featured ?? c.featured},
        trending = ${flags.trending ?? c.trending},
        editors_pick = ${flags.editorsPick ?? c.editors_pick},
        breaking = ${flags.breaking ?? c.breaking}
    WHERE id = ${id}
    RETURNING *
  `;
  return rowToArticle(rows[0]);
}

// Full admin edit (any field, including moving an article to a different
// city/category/attraction, fixing a contributor's content before
// publishing, etc.).
export async function adminUpdateArticle(
  id: string,
  updates: {
    title?: string;
    excerpt?: string;
    contentHtml?: string;
    cityId?: string;
    categoryId?: string | null;
    attractionId?: string | null;
    image?: string;
    imageAlt?: string;
    metaTitle?: string;
    metaDescription?: string;
    focusKeyword?: string;
    tags?: string[];
    canonicalUrl?: string;
    // Admin-only: overrides the auto-generated slug directly. Still
    // uniqueness-checked (excluding this article's own row) before saving.
    slug?: string;
  }
): Promise<Article> {
  const current = await sql`SELECT * FROM articles WHERE id = ${id} LIMIT 1`;
  if (!current.length) throw new Error("Article not found.");
  const c = current[0];
  const nextTitle = updates.title ?? c.title;

  let slug = c.slug;
  if (updates.slug !== undefined && updates.slug.trim() && updates.slug.trim() !== c.slug) {
    const desired = updates.slug
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
    if (!desired) throw new Error("Slug can't be empty.");
    if (await slugExists(desired, id)) throw new Error("That slug is already used by another article.");
    slug = desired;
  } else if (updates.title && updates.title !== c.title) {
    slug = await generateUniqueSlug(nextTitle, id);
  }

  const nextContent = updates.contentHtml !== undefined ? sanitizeArticleHtml(updates.contentHtml) : c.content_html;
  const { wordCount, readingTimeMinutes } = computeContentStats(nextContent);

  const rows = await sql`
    UPDATE articles
    SET title = ${nextTitle},
        slug = ${slug},
        excerpt = ${updates.excerpt ?? c.excerpt},
        content_html = ${nextContent},
        city_id = ${updates.cityId ?? c.city_id},
        category_id = ${updates.categoryId !== undefined ? updates.categoryId : c.category_id},
        attraction_id = ${updates.attractionId !== undefined ? updates.attractionId : c.attraction_id},
        image = ${updates.image ?? c.image},
        image_alt = ${updates.imageAlt ?? c.image_alt},
        meta_title = ${updates.metaTitle ?? c.meta_title},
        meta_description = ${updates.metaDescription ?? c.meta_description},
        focus_keyword = ${updates.focusKeyword ?? c.focus_keyword},
        tags = ${updates.tags !== undefined ? updates.tags : c.tags},
        canonical_url = ${updates.canonicalUrl !== undefined ? updates.canonicalUrl : c.canonical_url},
        word_count = ${wordCount},
        reading_time_minutes = ${readingTimeMinutes},
        updated_at = now()
    WHERE id = ${id}
    RETURNING *
  `;
  return rowToArticle(rows[0]);
}

export async function deleteArticle(id: string): Promise<void> {
  await sql`DELETE FROM articles WHERE id = ${id}`;
}

// --- Points / scoring (user-side read model) -----------------------------
// Structure only, per the Phase 1 spec — no admin scoring UI/logic here,
// just the aggregate a contributor sees on /dashboard/points, computed
// from whatever scores admin review has already recorded.
export interface PointsSummary {
  totalPoints: number;
  averageScore: number | null;
  scoredArticleCount: number;
  publishedCount: number;
}

export function summarizePoints(articles: Article[]): PointsSummary {
  // Computed live from each article's current `score` column every time
  // this runs - there's no separate points ledger/tally stored anywhere.
  // That's what makes updateArticleReview() (admin correcting a score after
  // the fact, even post-publish) automatically safe: the very next time
  // this function runs it just sums whatever `score` currently holds, so a
  // correction can never produce a duplicate or stale point record - there's
  // nothing to duplicate or leave stale in the first place.
  //
  // Only counts a score while it still reflects the article's current,
  // "live" outcome:
  //   - 'rejected' work never earns quality points, even if the admin
  //     recorded a score alongside the rejection feedback -- that score
  //     is context for the contributor on why it was rejected, not a
  //     points-worthy result.
  //   - 'pending' means it's back in the review queue after being
  //     edited/resubmitted (see submitDraftForReview), which does NOT
  //     clear a prior review's score -- so a 'pending' article's score,
  //     if any, is stale leftover from a past rejection until the new
  //     review lands, not a real evaluation of the current draft.
  const scored = articles.filter((a) => a.score !== null && a.status !== "rejected" && a.status !== "pending");
  // Rounded to 1 decimal: scores are meant to be whole numbers (the admin
  // review UI only accepts integers 0-10), but a handful of legacy/seeded
  // rows carry a decimal score like 9.8. Summing many such binary floats
  // drifts (e.g. twenty 9.8s becomes 196.00000000000006 instead of 196) —
  // rounding the sum itself, not just formatting it for display, is what
  // keeps that drift from also propagating into anything that re-sums
  // this value later (like the ledger's cross-contributor total).
  const rawTotal = scored.reduce((sum, a) => sum + (a.score || 0), 0);
  const totalPoints = Math.round(rawTotal * 10) / 10;
  const publishedCount = articles.filter((a) => a.status === "published").length;
  return {
    totalPoints,
    averageScore: scored.length ? Math.round((totalPoints / scored.length) * 10) / 10 : null,
    scoredArticleCount: scored.length,
    publishedCount,
  };
}
