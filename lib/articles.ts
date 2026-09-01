import { sql } from "./db";

export type ArticleStatus = "draft" | "pending" | "approved" | "rejected" | "published";

export interface Article {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  contentHtml: string;
  cityId: string;
  categoryId: string | null;
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
  submittedAt: string | null;
  reviewedAt: string | null;
  publishedAt: string | null;
  updatedAt: string;
}

// Joined shape used everywhere an article is displayed alongside its city/
// category/author names, rather than four separate lookups per article.
export interface ArticleWithRelations extends Article {
  cityName: string;
  citySlug: string;
  categoryName: string | null;
  categorySlug: string | null;
  authorName: string;
  authorEmail: string;
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
    submittedAt: toIso(row.submitted_at),
    reviewedAt: toIso(row.reviewed_at),
    publishedAt: toIso(row.published_at),
    updatedAt: toIso(row.updated_at) || "",
  };
}

function rowToArticleWithRelations(row: any): ArticleWithRelations {
  return {
    ...rowToArticle(row),
    cityName: row.city_name,
    citySlug: row.city_slug,
    categoryName: row.category_name,
    categorySlug: row.category_slug,
    authorName: row.author_name,
    authorEmail: row.author_email,
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
  SELECT a.*, c.name AS city_name, c.slug AS city_slug,
         cat.name AS category_name, cat.slug AS category_slug,
         u.display_name AS author_name, u.email AS author_email
  FROM articles a
  JOIN cities c ON c.id = a.city_id
  LEFT JOIN categories cat ON cat.id = a.category_id
  JOIN users u ON u.id = a.author_id
`;

// --- Public reads (published only) -----------------------------------

export async function getPublishedArticles(opts: {
  citySlug?: string;
  categorySlug?: string;
  limit?: number;
} = {}): Promise<ArticleWithRelations[]> {
  try {
    const limit = opts.limit ?? 200;
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
    params.push(limit);
    const query = `${JOIN_SELECT} WHERE ${conditions.join(" AND ")} ORDER BY a.published_at DESC LIMIT $${params.length}`;
    const rows = await sql(query, params);
    return rows.map(rowToArticleWithRelations);
  } catch {
    return [];
  }
}

export async function getPublishedArticleBySlug(
  citySlug: string,
  articleSlug: string
): Promise<ArticleWithRelations | undefined> {
  const query = `${JOIN_SELECT} WHERE a.status = 'published' AND c.slug = $1 AND a.slug = $2 LIMIT 1`;
  const rows = await sql(query, [citySlug, articleSlug]);
  return rows.length ? rowToArticleWithRelations(rows[0]) : undefined;
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
export async function getPublishedArticlesPage(opts: {
  citySlug?: string;
  categorySlug?: string;
  query?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<{ articles: ArticleWithRelations[]; total: number; page: number; pageSize: number; totalPages: number }> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = opts.pageSize ?? 12;
  try {
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

    const pageParams = [...params, pageSize, (page - 1) * pageSize];
    const query = `${JOIN_SELECT} WHERE ${where} ORDER BY a.published_at DESC LIMIT $${pageParams.length - 1} OFFSET $${pageParams.length}`;
    const rows = await sql(query, pageParams);

    return { articles: rows.map(rowToArticleWithRelations), total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  } catch {
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
      ORDER BY a.score DESC NULLS LAST, a.published_at DESC
      LIMIT $1
    `;
    const recentRows = await sql(recentQuery, [limit]);
    if (recentRows.length) return recentRows.map(rowToArticleWithRelations);

    const fallbackQuery = `${JOIN_SELECT} WHERE a.status = 'published' ORDER BY a.published_at DESC LIMIT $1`;
    const fallbackRows = await sql(fallbackQuery, [limit]);
    return fallbackRows.map(rowToArticleWithRelations);
  } catch {
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
  } catch {
    return [];
  }
}

// Real per-city / per-category published-article counts, used for "Popular
// Cities", the /cities index, and the /categories index — every number here
// comes straight from a COUNT(*) against real rows, never a placeholder.
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

// --- Dashboard reads (a contributor's own articles, any status) -------

export async function getArticlesByAuthor(authorId: string): Promise<ArticleWithRelations[]> {
  const query = `${JOIN_SELECT} WHERE a.author_id = $1 ORDER BY a.updated_at DESC`;
  const rows = await sql(query, [authorId]);
  return rows.map(rowToArticleWithRelations);
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

async function slugExists(slug: string, excludeId?: string): Promise<boolean> {
  const rows = excludeId
    ? await sql`SELECT id FROM articles WHERE slug = ${slug} AND id != ${excludeId} LIMIT 1`
    : await sql`SELECT id FROM articles WHERE slug = ${slug} LIMIT 1`;
  return rows.length > 0;
}

export async function generateUniqueSlug(title: string, excludeId?: string): Promise<string> {
  const base =
    title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 80) || "article";
  let slug = base;
  let i = 2;
  while (await slugExists(slug, excludeId)) {
    slug = `${base}-${i}`;
    i++;
  }
  return slug;
}

// --- Writes -------------------------------------------------------------

// A contributor submitting a new article directly (skipping the draft
// step) — used by the legacy "submit now" flow. Contributors aren't tied
// to a single city — cityId is whichever city the contributor selected on
// the submission form, validated by the API route to be a real city
// before this is called. authorId still always comes from the logged-in
// session, never the request body, so an article can never be submitted
// under someone else's name.
export async function createArticle(input: {
  title: string;
  excerpt: string;
  contentHtml: string;
  cityId: string;
  categoryId: string | null;
  authorId: string;
  image: string;
  imageAlt: string;
  metaTitle: string;
  metaDescription: string;
  focusKeyword: string;
}): Promise<Article> {
  const slug = await generateUniqueSlug(input.title);
  const { wordCount, readingTimeMinutes } = computeContentStats(input.contentHtml);
  const rows = await sql`
    INSERT INTO articles (
      slug, title, excerpt, content_html, city_id, category_id, author_id,
      status, image, image_alt, meta_title, meta_description, focus_keyword,
      word_count, reading_time_minutes, submitted_at, updated_at
    ) VALUES (
      ${slug}, ${input.title}, ${input.excerpt}, ${input.contentHtml}, ${input.cityId}, ${input.categoryId},
      ${input.authorId}, 'pending', ${input.image}, ${input.imageAlt}, ${input.metaTitle},
      ${input.metaDescription}, ${input.focusKeyword}, ${wordCount}, ${readingTimeMinutes}, now(), now()
    )
    RETURNING *
  `;
  return rowToArticle(rows[0]);
}

// Creates a new blank(ish) draft — the first save of the "Write New
// Article" flow. Status stays 'draft' (not submitted, invisible to admin
// queues and the public site) until the contributor explicitly submits it
// via submitDraftForReview(). cityId is required up front because the
// database column is NOT NULL (an article always belongs to exactly one
// city); the editor page collects title + city before the first autosave
// fires.
export async function createDraft(input: {
  title: string;
  cityId: string;
  categoryId: string | null;
  authorId: string;
}): Promise<Article> {
  const slug = await generateUniqueSlug(input.title || "untitled-draft");
  const rows = await sql`
    INSERT INTO articles (
      slug, title, excerpt, content_html, city_id, category_id, author_id, status, updated_at
    ) VALUES (
      ${slug}, ${input.title || "Untitled draft"}, '', '', ${input.cityId}, ${input.categoryId},
      ${input.authorId}, 'draft', now()
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
    excerpt?: string;
    contentHtml?: string;
    cityId?: string;
    categoryId?: string | null;
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
  const slug = updates.title && updates.title !== c.title ? await generateUniqueSlug(nextTitle, id) : c.slug;
  const nextContent = updates.contentHtml ?? c.content_html;
  const { wordCount, readingTimeMinutes } = computeContentStats(nextContent);

  const rows = await sql`
    UPDATE articles
    SET title = ${nextTitle},
        slug = ${slug},
        excerpt = ${updates.excerpt ?? c.excerpt},
        content_html = ${nextContent},
        city_id = ${updates.cityId ?? c.city_id},
        category_id = ${updates.categoryId !== undefined ? updates.categoryId : c.category_id},
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
// submitted_at stamped, and the originality-check result snapshotted onto
// the row (so admin review can see the score without re-running the check
// later). Only callable on an article that is currently 'draft'.
export async function submitDraftForReview(
  id: string,
  originality: { score: number; flag: boolean }
): Promise<Article> {
  const rows = await sql`
    UPDATE articles
    SET status = 'pending',
        submitted_at = now(),
        originality_score = ${originality.score},
        originality_flag = ${originality.flag},
        updated_at = now()
    WHERE id = ${id} AND status = 'draft'
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

// A contributor editing their own pending/rejected article (an edit that
// resubmits it for review). The route handler must verify
// article.authorId === session.userId AND article.status is 'pending' or
// 'rejected' before calling this. cityId IS accepted here — contributors
// aren't tied to one city, so they choose which city an article belongs to
// at submission time and can change that choice while it's still
// pending/rejected.
export async function updateOwnArticle(
  id: string,
  updates: {
    title?: string;
    excerpt?: string;
    contentHtml?: string;
    cityId?: string;
    categoryId?: string | null;
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
  const slug = updates.title && updates.title !== c.title ? await generateUniqueSlug(nextTitle, id) : c.slug;
  const nextContent = updates.contentHtml ?? c.content_html;
  const { wordCount, readingTimeMinutes } = computeContentStats(nextContent);

  const rows = await sql`
    UPDATE articles
    SET title = ${nextTitle},
        slug = ${slug},
        excerpt = ${updates.excerpt ?? c.excerpt},
        content_html = ${nextContent},
        city_id = ${updates.cityId ?? c.city_id},
        category_id = ${updates.categoryId !== undefined ? updates.categoryId : c.category_id},
        image = ${updates.image ?? c.image},
        image_alt = ${updates.imageAlt ?? c.image_alt},
        meta_title = ${updates.metaTitle ?? c.meta_title},
        meta_description = ${updates.metaDescription ?? c.meta_description},
        focus_keyword = ${updates.focusKeyword ?? c.focus_keyword},
        word_count = ${wordCount},
        reading_time_minutes = ${readingTimeMinutes},
        status = 'pending',
        submitted_at = COALESCE(submitted_at, now()),
        reviewed_at = NULL,
        updated_at = now()
    WHERE id = ${id}
    RETURNING *
  `;
  return rowToArticle(rows[0]);
}

// Admin review — sets a 0-10 quality score, optional written feedback, and
// approves or rejects. A separate publishArticle() call is required to
// actually put an approved article live (kept as two steps deliberately:
// an admin can approve+score an article as "good enough" without it
// appearing on the public site until they're ready to publish).
export async function reviewArticle(
  id: string,
  input: { status: "approved" | "rejected"; score: number | null; feedback: string }
): Promise<Article> {
  const rows = await sql`
    UPDATE articles
    SET status = ${input.status},
        score = ${input.score},
        admin_feedback = ${input.feedback},
        reviewed_at = now(),
        updated_at = now()
    WHERE id = ${id}
    RETURNING *
  `;
  if (!rows.length) throw new Error("Article not found.");
  return rowToArticle(rows[0]);
}

export async function publishArticle(id: string): Promise<Article> {
  const rows = await sql`
    UPDATE articles
    SET status = 'published', published_at = now(), updated_at = now()
    WHERE id = ${id}
    RETURNING *
  `;
  if (!rows.length) throw new Error("Article not found.");
  return rowToArticle(rows[0]);
}

// Pulls a published article back to "approved" — off the public site, but
// keeps the score/feedback/review history intact (unlike reject, which is
// meant for content that was never good enough to publish in the first
// place). Used for e.g. "this needs an urgent correction."
export async function unpublishArticle(id: string): Promise<Article> {
  const rows = await sql`
    UPDATE articles
    SET status = 'approved', published_at = NULL, updated_at = now()
    WHERE id = ${id}
    RETURNING *
  `;
  if (!rows.length) throw new Error("Article not found.");
  return rowToArticle(rows[0]);
}

// Full admin edit (any field, including moving an article to a different
// city/category, fixing a contributor's content before publishing, etc.).
export async function adminUpdateArticle(
  id: string,
  updates: {
    title?: string;
    excerpt?: string;
    contentHtml?: string;
    cityId?: string;
    categoryId?: string | null;
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

  const nextContent = updates.contentHtml ?? c.content_html;
  const { wordCount, readingTimeMinutes } = computeContentStats(nextContent);

  const rows = await sql`
    UPDATE articles
    SET title = ${nextTitle},
        slug = ${slug},
        excerpt = ${updates.excerpt ?? c.excerpt},
        content_html = ${nextContent},
        city_id = ${updates.cityId ?? c.city_id},
        category_id = ${updates.categoryId !== undefined ? updates.categoryId : c.category_id},
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
  const scored = articles.filter((a) => a.score !== null);
  const totalPoints = scored.reduce((sum, a) => sum + (a.score || 0), 0);
  const publishedCount = articles.filter((a) => a.status === "published").length;
  return {
    totalPoints,
    averageScore: scored.length ? Math.round((totalPoints / scored.length) * 10) / 10 : null,
    scoredArticleCount: scored.length,
    publishedCount,
  };
}
