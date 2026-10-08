import { sql } from "../db";

export type NewsSourceType = "rss" | "google_news_rss" | "newsapi" | "currents";

export const NEWS_SOURCE_TYPES: { value: NewsSourceType; label: string }[] = [
  { value: "rss", label: "RSS / Atom feed" },
  { value: "google_news_rss", label: "Google News RSS query" },
  { value: "newsapi", label: "NewsAPI query" },
  { value: "currents", label: "Currents API query" },
];

export const NEWS_CATEGORIES = [
  "Aviation",
  "Destinations",
  "Attractions",
  "Travel Rules",
  "Hotels",
  "Cruises",
  "Travel Industry",
  "General",
] as const;

export interface NewsSource {
  id: string;
  name: string;
  type: NewsSourceType;
  url: string;
  rssUrl: string;
  apiProvider: string;
  query: string;
  category: string;
  country: string;
  isActive: boolean;
  reliabilityScore: number;
  fetchIntervalMinutes: number;
  etag: string;
  lastModified: string;
  lastFetchedAt: string | null;
  lastStatus: string;
  lastError: string;
  lastItemCount: number;
  consecutiveFailures: number;
  createdAt: string;
}

function iso(v: unknown): string | null {
  if (!v) return null;
  return v instanceof Date ? v.toISOString() : String(v);
}

export function rowToSource(row: any): NewsSource {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    url: row.url || "",
    rssUrl: row.rss_url || "",
    apiProvider: row.api_provider || "",
    query: row.query || "",
    category: row.category || "",
    country: row.country || "",
    isActive: !!row.is_active,
    reliabilityScore: Number(row.reliability_score ?? 50),
    fetchIntervalMinutes: Number(row.fetch_interval_minutes ?? 30),
    etag: row.etag || "",
    lastModified: row.last_modified || "",
    lastFetchedAt: iso(row.last_fetched_at),
    lastStatus: row.last_status || "",
    lastError: row.last_error || "",
    lastItemCount: Number(row.last_item_count ?? 0),
    consecutiveFailures: Number(row.consecutive_failures ?? 0),
    createdAt: iso(row.created_at) || "",
  };
}

// Recommended starting set. All RSS feeds below were checked as live and
// well-formed when this was written. Reliability scores are the editor's
// starting judgement, editable per source in Admin → Trending News → Sources.
// The Google News queries are discovery-only: they surface headlines and the
// original publisher; facts must still be verified against primary sources.
export const DEFAULT_NEWS_SOURCES: Omit<
  NewsSource,
  "id" | "etag" | "lastModified" | "lastFetchedAt" | "lastStatus" | "lastError" | "lastItemCount" | "consecutiveFailures" | "createdAt"
>[] = [
  {
    name: "Skift",
    type: "rss",
    url: "https://skift.com",
    rssUrl: "https://skift.com/feed/",
    apiProvider: "",
    query: "",
    category: "Travel Industry",
    country: "",
    isActive: true,
    reliabilityScore: 80,
    fetchIntervalMinutes: 30,
  },
  {
    name: "Simple Flying",
    type: "rss",
    url: "https://simpleflying.com",
    rssUrl: "https://simpleflying.com/feed/",
    apiProvider: "",
    query: "",
    category: "Aviation",
    country: "",
    isActive: true,
    reliabilityScore: 65,
    fetchIntervalMinutes: 30,
  },
  {
    name: "Travel And Tour World",
    type: "rss",
    url: "https://www.travelandtourworld.com",
    rssUrl: "https://www.travelandtourworld.com/feed/",
    apiProvider: "",
    query: "",
    category: "Destinations",
    country: "",
    isActive: true,
    reliabilityScore: 55,
    fetchIntervalMinutes: 30,
  },
  {
    name: "The Points Guy",
    type: "rss",
    url: "https://thepointsguy.com",
    rssUrl: "https://thepointsguy.com/feed/",
    apiProvider: "",
    query: "",
    category: "Travel Industry",
    country: "",
    isActive: true,
    reliabilityScore: 65,
    fetchIntervalMinutes: 60,
  },
  {
    name: "Cruise Industry News",
    type: "rss",
    url: "https://www.cruiseindustrynews.com",
    rssUrl: "https://cruiseindustrynews.com/feed/",
    apiProvider: "",
    query: "",
    category: "Cruises",
    country: "",
    isActive: true,
    reliabilityScore: 70,
    fetchIntervalMinutes: 60,
  },
  {
    name: "Euronews Travel",
    type: "rss",
    url: "https://www.euronews.com/travel",
    rssUrl: "https://www.euronews.com/rss?level=vertical&name=travel",
    apiProvider: "",
    query: "",
    category: "Destinations",
    country: "",
    isActive: true,
    reliabilityScore: 75,
    fetchIntervalMinutes: 30,
  },
  {
    name: "Google News: visa & entry rules",
    type: "google_news_rss",
    url: "https://news.google.com",
    rssUrl: "https://news.google.com/rss/search?q=%28tourist+OR+visitors+OR+travelers%29+%28visa+OR+%22entry+requirements%22+OR+%22tourist+tax%22+OR+%22travel+rules%22%29+when%3A2d&hl=en-US&gl=US&ceid=US%3Aen",
    apiProvider: "",
    query: "visa / entry rules / tourist tax",
    category: "Travel Rules",
    country: "",
    isActive: true,
    reliabilityScore: 50,
    fetchIntervalMinutes: 60,
  },
  {
    name: "Google News: new attractions & visitor changes",
    type: "google_news_rss",
    url: "https://news.google.com",
    rssUrl: "https://news.google.com/rss/search?q=%28attraction+OR+museum+OR+landmark+OR+%22theme+park%22%29+%28opens+OR+reopens+OR+%22new+rules%22+OR+%22ticket%22+OR+%22visitor%22%29+when%3A2d&hl=en-US&gl=US&ceid=US%3Aen",
    apiProvider: "",
    query: "attraction opens / visitor changes",
    category: "Attractions",
    country: "",
    isActive: true,
    reliabilityScore: 50,
    fetchIntervalMinutes: 60,
  },
  {
    name: "Google News: airlines, routes & airports",
    type: "google_news_rss",
    url: "https://news.google.com",
    rssUrl: "https://news.google.com/rss/search?q=%28airline+OR+airport%29+%28%22new+route%22+OR+%22new+terminal%22+OR+launches+OR+cancels%29+when%3A2d&hl=en-US&gl=US&ceid=US%3Aen",
    apiProvider: "",
    query: "airline new routes / airport terminals",
    category: "Aviation",
    country: "",
    isActive: true,
    reliabilityScore: 50,
    fetchIntervalMinutes: 60,
  },
];

export async function getNewsSources(): Promise<NewsSource[]> {
  const rows = await sql`SELECT * FROM news_sources ORDER BY is_active DESC, name ASC`;
  return rows.map(rowToSource);
}

export async function getNewsSource(id: string): Promise<NewsSource | undefined> {
  const rows = await sql`SELECT * FROM news_sources WHERE id = ${id} LIMIT 1`;
  return rows[0] ? rowToSource(rows[0]) : undefined;
}

export interface NewsSourceInput {
  name: string;
  type: NewsSourceType;
  url?: string;
  rssUrl?: string;
  query?: string;
  category?: string;
  country?: string;
  isActive?: boolean;
  reliabilityScore?: number;
  fetchIntervalMinutes?: number;
}

export function validateNewsSourceInput(input: any): string | null {
  if (!input || typeof input !== "object") return "Invalid request.";
  if (!String(input.name || "").trim()) return "Source name is required.";
  if (!NEWS_SOURCE_TYPES.some((t) => t.value === input.type)) return "Pick a valid source type.";
  if (input.type === "rss" || input.type === "google_news_rss") {
    const u = String(input.rssUrl || "").trim();
    if (!/^https?:\/\//i.test(u)) return "A feed URL starting with http:// or https:// is required.";
  } else if (!String(input.query || "").trim()) {
    return "A search query is required for API sources.";
  }
  const score = Number(input.reliabilityScore ?? 50);
  if (!Number.isFinite(score) || score < 0 || score > 100) return "Reliability must be 0–100.";
  const interval = Number(input.fetchIntervalMinutes ?? 30);
  if (!Number.isFinite(interval) || interval < 10 || interval > 1440) return "Check interval must be 10–1440 minutes.";
  return null;
}

function providerFor(type: string): string {
  return type === "newsapi" ? "newsapi" : type === "currents" ? "currents" : "";
}

export async function createNewsSource(input: NewsSourceInput): Promise<NewsSource> {
  const rows = await sql`
    INSERT INTO news_sources
      (name, type, url, rss_url, api_provider, query, category, country, is_active, reliability_score, fetch_interval_minutes)
    VALUES (
      ${input.name.trim()}, ${input.type}, ${(input.url || "").trim()}, ${(input.rssUrl || "").trim()},
      ${providerFor(input.type)}, ${(input.query || "").trim()}, ${(input.category || "").trim()}, ${(input.country || "").trim()},
      ${input.isActive !== false}, ${Math.round(Number(input.reliabilityScore ?? 50))}, ${Math.round(Number(input.fetchIntervalMinutes ?? 30))}
    )
    RETURNING *
  `;
  return rowToSource(rows[0]);
}

export async function updateNewsSource(id: string, input: NewsSourceInput): Promise<NewsSource | undefined> {
  const rows = await sql`
    UPDATE news_sources SET
      name = ${input.name.trim()},
      type = ${input.type},
      url = ${(input.url || "").trim()},
      rss_url = ${(input.rssUrl || "").trim()},
      api_provider = ${providerFor(input.type)},
      query = ${(input.query || "").trim()},
      category = ${(input.category || "").trim()},
      country = ${(input.country || "").trim()},
      is_active = ${input.isActive !== false},
      reliability_score = ${Math.round(Number(input.reliabilityScore ?? 50))},
      fetch_interval_minutes = ${Math.round(Number(input.fetchIntervalMinutes ?? 30))},
      etag = '',
      last_modified = ''
    WHERE id = ${id}
    RETURNING *
  `;
  return rows[0] ? rowToSource(rows[0]) : undefined;
}

export async function setNewsSourceActive(id: string, isActive: boolean): Promise<void> {
  await sql`UPDATE news_sources SET is_active = ${isActive} WHERE id = ${id}`;
}

export async function deleteNewsSource(id: string): Promise<void> {
  await sql`DELETE FROM news_sources WHERE id = ${id}`;
}

// Adds any recommended source not already present (matched on feed URL).
// Never overwrites or reactivates anything an admin has edited or disabled.
export async function loadDefaultNewsSources(): Promise<number> {
  let added = 0;
  for (const s of DEFAULT_NEWS_SOURCES) {
    const rows = await sql`
      INSERT INTO news_sources
        (name, type, url, rss_url, api_provider, query, category, country, is_active, reliability_score, fetch_interval_minutes)
      VALUES (${s.name}, ${s.type}, ${s.url}, ${s.rssUrl}, ${s.apiProvider}, ${s.query}, ${s.category}, ${s.country},
              ${s.isActive}, ${s.reliabilityScore}, ${s.fetchIntervalMinutes})
      ON CONFLICT (lower(rss_url)) WHERE rss_url <> '' DO NOTHING
      RETURNING id
    `;
    added += rows.length;
  }
  return added;
}
