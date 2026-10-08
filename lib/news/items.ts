import { sql } from "../db";

export interface NewsItem {
  id: string;
  sourceId: string;
  sourceName: string;
  reliabilityScore: number;
  title: string;
  description: string;
  url: string;
  imageUrl: string;
  author: string;
  publishedAt: string | null;
  category: string;
  status: string;
  createdAt: string;
  duplicateCount: number;
  relevanceScore: number | null;
  relevanceCategory: string;
  filterStatus: string;
  filterReason: string;
}

export interface NewsStats {
  total: number;
  last24h: number;
  activeSources: number;
  failingSources: number;
  lastRunAt: string | null;
}

export interface NewsRun {
  id: number;
  trigger: string;
  startedAt: string;
  finishedAt: string | null;
  sourcesChecked: number;
  itemsFound: number;
  itemsNew: number;
  errors: number;
}

const iso = (v: unknown): string | null => (v ? (v instanceof Date ? v.toISOString() : String(v)) : null);

export async function listNewsItems(opts: {
  q?: string;
  sourceId?: string;
  category?: string;
  status?: string;
  relevance?: string; // relevant | borderline | irrelevant | pending | "" (all but irrelevant)
  limit?: number;
  offset?: number;
}): Promise<{ items: NewsItem[]; total: number }> {
  const relevance = opts.relevance ?? "";
  const q = (opts.q || "").trim();
  const like = q ? `%${q.replace(/[%_\\]/g, (c) => "\\" + c)}%` : "";
  const sourceId = opts.sourceId || "";
  const category = opts.category || "";
  const status = opts.status || "";
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);

  const rows = await sql`
    SELECT i.*, s.name AS source_name, s.reliability_score,
      (SELECT COUNT(*)::int - 1 FROM news_items d WHERE d.content_hash = i.content_hash) AS duplicate_count
    FROM news_items i
    JOIN news_sources s ON s.id = i.source_id
    WHERE (${like} = '' OR i.title ILIKE ${like} OR i.description ILIKE ${like})
      AND (${sourceId} = '' OR i.source_id::text = ${sourceId})
      AND (${category} = '' OR i.category = ${category})
      AND (${status} = '' OR i.status = ${status})
      AND (${relevance} = 'all' OR (${relevance} = '' AND i.filter_status <> 'irrelevant') OR i.filter_status = ${relevance})
    ORDER BY COALESCE(i.published_at, i.created_at) DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  const countRows = await sql`
    SELECT COUNT(*)::int AS n FROM news_items i
    WHERE (${like} = '' OR i.title ILIKE ${like} OR i.description ILIKE ${like})
      AND (${sourceId} = '' OR i.source_id::text = ${sourceId})
      AND (${category} = '' OR i.category = ${category})
      AND (${status} = '' OR i.status = ${status})
      AND (${relevance} = 'all' OR (${relevance} = '' AND i.filter_status <> 'irrelevant') OR i.filter_status = ${relevance})
  `;
  return {
    total: Number(countRows[0]?.n ?? 0),
    items: rows.map((r: any) => ({
      id: r.id,
      sourceId: r.source_id,
      sourceName: r.source_name,
      reliabilityScore: Number(r.reliability_score ?? 50),
      title: r.title,
      description: r.description || "",
      url: r.url || "",
      imageUrl: r.image_url || "",
      author: r.author || "",
      publishedAt: iso(r.published_at),
      category: r.category || "",
      status: r.status,
      createdAt: iso(r.created_at) || "",
      duplicateCount: Math.max(0, Number(r.duplicate_count ?? 0)),
      relevanceScore: r.relevance_score == null ? null : Number(r.relevance_score),
      relevanceCategory: r.relevance_category || "",
      filterStatus: r.filter_status || "pending",
      filterReason: r.filter_reason || "",
    })),
  };
}

export async function setNewsItemStatus(id: string, status: string): Promise<void> {
  await sql`UPDATE news_items SET status = ${status} WHERE id = ${id}`;
}

export async function getNewsStats(): Promise<NewsStats> {
  const [a, b, c] = await Promise.all([
    sql`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE created_at > now() - interval '24 hours')::int AS last24h FROM news_items`,
    sql`SELECT COUNT(*) FILTER (WHERE is_active)::int AS active, COUNT(*) FILTER (WHERE is_active AND consecutive_failures >= 3)::int AS failing FROM news_sources`,
    sql`SELECT MAX(finished_at) AS last FROM news_fetch_runs`,
  ]);
  return {
    total: Number(a[0]?.total ?? 0),
    last24h: Number(a[0]?.last24h ?? 0),
    activeSources: Number(b[0]?.active ?? 0),
    failingSources: Number(b[0]?.failing ?? 0),
    lastRunAt: iso(c[0]?.last),
  };
}

export async function listNewsRuns(limit = 10): Promise<NewsRun[]> {
  const rows = await sql`SELECT * FROM news_fetch_runs ORDER BY id DESC LIMIT ${limit}`;
  return rows.map((r: any) => ({
    id: r.id,
    trigger: r.trigger,
    startedAt: iso(r.started_at) || "",
    finishedAt: iso(r.finished_at),
    sourcesChecked: r.sources_checked,
    itemsFound: r.items_found,
    itemsNew: r.items_new,
    errors: r.errors,
  }));
}
