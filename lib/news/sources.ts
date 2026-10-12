import { sql } from "../db";

export type NewsSourceType = "rss" | "google_news_rss" | "newsapi" | "currents";

export const NEWS_SOURCE_TYPES: { value: NewsSourceType; label: string }[] = [
  { value: "rss", label: "RSS / Atom feed" },
  { value: "google_news_rss", label: "Google News RSS query" },
  { value: "newsapi", label: "NewsAPI query" },
  { value: "currents", label: "Currents API query" },
];

// Aggregators relay other publishers' stories, so they can never be official.
export const AGGREGATOR_TYPES: NewsSourceType[] = ["google_news_rss", "newsapi", "currents"];

// Priority 1 (lowest) to 5 (highest): the collector checks higher-priority
// sources first when its time budget is short, and research reads them first.
export const DEFAULT_PRIORITY = 3;

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
  // The publisher is the body the news is about (a government, airline,
  // airport, operator or tourism board), so research treats it as official.
  isOfficial: boolean;
  priority: number;
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
    isOfficial: !!row.is_official,
    priority: Number(row.priority ?? DEFAULT_PRIORITY),
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
export type NewsSourceSeed = Omit<
  NewsSource,
  "id" | "etag" | "lastModified" | "lastFetchedAt" | "lastStatus" | "lastError" | "lastItemCount" | "consecutiveFailures" | "createdAt"
>;

export const DEFAULT_NEWS_SOURCES: NewsSourceSeed[] = [
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
    isOfficial: false,
    priority: DEFAULT_PRIORITY,
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
    isOfficial: false,
    priority: DEFAULT_PRIORITY,
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
    isOfficial: false,
    priority: DEFAULT_PRIORITY,
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
    isOfficial: false,
    priority: DEFAULT_PRIORITY,
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
    isOfficial: false,
    priority: DEFAULT_PRIORITY,
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
    isOfficial: false,
    priority: DEFAULT_PRIORITY,
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
    isOfficial: false,
    priority: DEFAULT_PRIORITY,
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
    isOfficial: false,
    priority: DEFAULT_PRIORITY,
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
    isOfficial: false,
    priority: DEFAULT_PRIORITY,
  },
];

// More travel news feeds, each tested before adding (October 2026): fresh
// (posted within the last day) and readable. Skipped: Travel Weekly,
// TravelPulse, Cruise Critic and Hospitality Net (block feed readers), and
// feeds that had not posted for 2-3 days.
export const MORE_NEWS_SOURCES: NewsSourceSeed[] = [
  { name: "The Guardian Travel", type: "rss", url: "https://www.theguardian.com/travel", rssUrl: "https://www.theguardian.com/travel/rss", apiProvider: "", query: "", category: "Destinations", country: "United Kingdom", isActive: true, reliabilityScore: 85, fetchIntervalMinutes: 30, isOfficial: false, priority: DEFAULT_PRIORITY },
  { name: "The Independent Travel", type: "rss", url: "https://www.independent.co.uk/travel", rssUrl: "https://www.independent.co.uk/travel/rss", apiProvider: "", query: "", category: "Destinations", country: "United Kingdom", isActive: true, reliabilityScore: 80, fetchIntervalMinutes: 30, isOfficial: false, priority: DEFAULT_PRIORITY },
  { name: "Condé Nast Traveler", type: "rss", url: "https://www.cntraveler.com", rssUrl: "https://www.cntraveler.com/feed/rss", apiProvider: "", query: "", category: "Destinations", country: "", isActive: true, reliabilityScore: 80, fetchIntervalMinutes: 30, isOfficial: false, priority: DEFAULT_PRIORITY },
  { name: "TravelDailyNews", type: "rss", url: "https://www.traveldailynews.com", rssUrl: "https://www.traveldailynews.com/feed/", apiProvider: "", query: "", category: "Travel Industry", country: "", isActive: true, reliabilityScore: 65, fetchIntervalMinutes: 30, isOfficial: false, priority: DEFAULT_PRIORITY },
  { name: "One Mile at a Time", type: "rss", url: "https://onemileatatime.com", rssUrl: "https://onemileatatime.com/feed/", apiProvider: "", query: "", category: "Aviation", country: "", isActive: true, reliabilityScore: 70, fetchIntervalMinutes: 30, isOfficial: false, priority: DEFAULT_PRIORITY },
  { name: "View from the Wing", type: "rss", url: "https://viewfromthewing.com", rssUrl: "https://viewfromthewing.com/feed/", apiProvider: "", query: "", category: "Aviation", country: "", isActive: true, reliabilityScore: 70, fetchIntervalMinutes: 30, isOfficial: false, priority: DEFAULT_PRIORITY },
  { name: "AeroRoutes", type: "rss", url: "https://www.aeroroutes.com", rssUrl: "https://www.aeroroutes.com/eng?format=rss", apiProvider: "", query: "", category: "Aviation", country: "", isActive: true, reliabilityScore: 80, fetchIntervalMinutes: 30, isOfficial: false, priority: DEFAULT_PRIORITY },
  { name: "Aviation A2Z", type: "rss", url: "https://aviationa2z.com", rssUrl: "https://aviationa2z.com/index.php/feed/", apiProvider: "", query: "", category: "Aviation", country: "", isActive: true, reliabilityScore: 65, fetchIntervalMinutes: 30, isOfficial: false, priority: DEFAULT_PRIORITY },
  { name: "Cruise Hive", type: "rss", url: "https://www.cruisehive.com", rssUrl: "https://www.cruisehive.com/feed", apiProvider: "", query: "", category: "Cruises", country: "", isActive: true, reliabilityScore: 70, fetchIntervalMinutes: 30, isOfficial: false, priority: DEFAULT_PRIORITY },
  { name: "Loyalty Lobby", type: "rss", url: "https://loyaltylobby.com", rssUrl: "https://loyaltylobby.com/feed/", apiProvider: "", query: "", category: "Hotels", country: "", isActive: true, reliabilityScore: 65, fetchIntervalMinutes: 30, isOfficial: false, priority: DEFAULT_PRIORITY },
  { name: "Travel Off Path", type: "rss", url: "https://www.traveloffpath.com", rssUrl: "https://www.traveloffpath.com/feed/", apiProvider: "", query: "", category: "Travel Rules", country: "", isActive: true, reliabilityScore: 65, fetchIntervalMinutes: 30, isOfficial: false, priority: DEFAULT_PRIORITY },
  { name: "Theme Park Insider", type: "rss", url: "https://www.themeparkinsider.com", rssUrl: "https://www.themeparkinsider.com/news/rss.xml", apiProvider: "", query: "", category: "Attractions", country: "", isActive: true, reliabilityScore: 70, fetchIntervalMinutes: 30, isOfficial: false, priority: DEFAULT_PRIORITY },
  { name: "Attractions Magazine", type: "rss", url: "https://attractionsmagazine.com", rssUrl: "https://attractionsmagazine.com/feed/", apiProvider: "", query: "", category: "Attractions", country: "", isActive: true, reliabilityScore: 65, fetchIntervalMinutes: 30, isOfficial: false, priority: DEFAULT_PRIORITY },
  { name: "Google News: hotel & resort openings", type: "google_news_rss", url: "https://news.google.com", rssUrl: "https://news.google.com/rss/search?q=%28hotel+OR+resort%29+%28opens+OR+opening+OR+unveils+OR+launches%29+when%3A1d&hl=en-US&gl=US&ceid=US%3Aen", apiProvider: "", query: "", category: "Hotels", country: "", isActive: true, reliabilityScore: 60, fetchIntervalMinutes: 30, isOfficial: false, priority: DEFAULT_PRIORITY },
  { name: "Google News: cruise news", type: "google_news_rss", url: "https://news.google.com", rssUrl: "https://news.google.com/rss/search?q=%28%22cruise+line%22+OR+%22cruise+ship%22%29+%28new+OR+launches+OR+cancels+OR+itinerary+OR+debut%29+when%3A1d&hl=en-US&gl=US&ceid=US%3Aen", apiProvider: "", query: "", category: "Cruises", country: "", isActive: true, reliabilityScore: 60, fetchIntervalMinutes: 30, isOfficial: false, priority: DEFAULT_PRIORITY },
  { name: "Google News: tourism trends & fees", type: "google_news_rss", url: "https://news.google.com", rssUrl: "https://news.google.com/rss/search?q=%28tourism+OR+tourists+OR+overtourism%29+%28record+OR+ban+OR+fee+OR+%22tourist+tax%22+OR+limit%29+when%3A1d&hl=en-US&gl=US&ceid=US%3Aen", apiProvider: "", query: "", category: "Destinations", country: "", isActive: true, reliabilityScore: 60, fetchIntervalMinutes: 30, isOfficial: false, priority: DEFAULT_PRIORITY },
];

// Official sources: the body the news is about speaking for itself. Every
// feed was fetched and parsed when this list was written (October 2026), and
// reviewed by hand: English, news rather than site pages, updated recently.
// (KLM and Schiphol publish their feeds in Dutch only; the EU Home Affairs
// feed is mostly migration policy.)
// They are added inactive so an editor can check each one before the
// collector starts reading it. Their stories are often corporate (results,
// staff profiles), so the travel filter still decides what reaches Stories.
export const OFFICIAL_NEWS_SOURCES: NewsSourceSeed[] = [
  { name: "US State Department: travel advisories", type: "rss", url: "https://travel.state.gov", rssUrl: "https://travel.state.gov/_res/rss/TAsTWs.xml", apiProvider: "", query: "", category: "Travel Rules", country: "United States", isActive: false, reliabilityScore: 95, fetchIntervalMinutes: 60, isOfficial: true, priority: 5 },
  { name: "UK FCDO: foreign travel advice", type: "rss", url: "https://www.gov.uk/foreign-travel-advice", rssUrl: "https://www.gov.uk/foreign-travel-advice.atom", apiProvider: "", query: "", category: "Travel Rules", country: "United Kingdom", isActive: false, reliabilityScore: 95, fetchIntervalMinutes: 60, isOfficial: true, priority: 5 },
  { name: "CDC: travel health notices", type: "rss", url: "https://wwwnc.cdc.gov/travel", rssUrl: "https://wwwnc.cdc.gov/travel/rss/notices.xml", apiProvider: "", query: "", category: "Travel Rules", country: "United States", isActive: false, reliabilityScore: 90, fetchIntervalMinutes: 180, isOfficial: true, priority: 4 },
  { name: "Delta Air Lines newsroom", type: "rss", url: "https://www.delta.com", rssUrl: "https://news.delta.com/rss.xml", apiProvider: "", query: "", category: "Aviation", country: "United States", isActive: false, reliabilityScore: 90, fetchIntervalMinutes: 60, isOfficial: true, priority: 4 },
  { name: "United Airlines newsroom", type: "rss", url: "https://www.united.com", rssUrl: "https://united.mediaroom.com/news-releases?pagetemplate=rss", apiProvider: "", query: "", category: "Aviation", country: "United States", isActive: false, reliabilityScore: 90, fetchIntervalMinutes: 60, isOfficial: true, priority: 4 },
  { name: "Alaska Airlines newsroom", type: "rss", url: "https://www.alaskaair.com", rssUrl: "https://news.alaskaair.com/feed/", apiProvider: "", query: "", category: "Aviation", country: "United States", isActive: false, reliabilityScore: 90, fetchIntervalMinutes: 60, isOfficial: true, priority: 4 },
  { name: "daa (Dublin and Cork airports)", type: "rss", url: "https://www.daa.ie", rssUrl: "https://www.daa.ie/feed/", apiProvider: "", query: "", category: "Aviation", country: "Ireland", isActive: false, reliabilityScore: 85, fetchIntervalMinutes: 180, isOfficial: true, priority: 3 },
  { name: "Frontier Airlines newsroom", type: "rss", url: "https://www.flyfrontier.com", rssUrl: "https://news.flyfrontier.com/feed/", apiProvider: "", query: "", category: "Aviation", country: "United States", isActive: false, reliabilityScore: 85, fetchIntervalMinutes: 120, isOfficial: true, priority: 3 },
  { name: "Amtrak media", type: "rss", url: "https://www.amtrak.com", rssUrl: "https://media.amtrak.com/feed/", apiProvider: "", query: "", category: "Travel Industry", country: "United States", isActive: false, reliabilityScore: 90, fetchIntervalMinutes: 120, isOfficial: true, priority: 3 },
  { name: "Hilton stories", type: "rss", url: "https://www.hilton.com", rssUrl: "https://stories.hilton.com/feed", apiProvider: "", query: "", category: "Hotels", country: "", isActive: false, reliabilityScore: 85, fetchIntervalMinutes: 180, isOfficial: true, priority: 3 },
  { name: "Carnival Corporation news", type: "rss", url: "https://www.carnivalcorp.com", rssUrl: "https://www.carnivalcorp.com/rss", apiProvider: "", query: "", category: "Cruises", country: "", isActive: false, reliabilityScore: 85, fetchIntervalMinutes: 180, isOfficial: true, priority: 3 },
  { name: "Disney Parks Blog", type: "rss", url: "https://disneyparks.disney.go.com", rssUrl: "https://disneyparksblog.com/feed/", apiProvider: "", query: "", category: "Attractions", country: "", isActive: false, reliabilityScore: 85, fetchIntervalMinutes: 120, isOfficial: true, priority: 3 },
  { name: "Universal Orlando blog", type: "rss", url: "https://www.universalorlando.com", rssUrl: "https://blog.universalorlando.com/feed/", apiProvider: "", query: "", category: "Attractions", country: "United States", isActive: false, reliabilityScore: 85, fetchIntervalMinutes: 180, isOfficial: true, priority: 3 },
];

export async function getNewsSources(): Promise<NewsSource[]> {
  const rows = await sql`SELECT * FROM news_sources ORDER BY is_active DESC, name ASC`;
  // Rows read before scripts/setup-db.mjs added is_official/priority simply
  // come back without them; rowToSource defaults both.
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
  isOfficial?: boolean;
  priority?: number;
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
  const priority = Number(input.priority ?? DEFAULT_PRIORITY);
  if (!Number.isInteger(priority) || priority < 1 || priority > 5) return "Priority must be 1–5.";
  if (input.isOfficial && AGGREGATOR_TYPES.includes(input.type)) return "Search and aggregator sources can't be official; only a feed published by the body itself can.";
  return null;
}

function providerFor(type: string): string {
  return type === "newsapi" ? "newsapi" : type === "currents" ? "currents" : "";
}

export async function createNewsSource(input: NewsSourceInput): Promise<NewsSource> {
  const rows = await sql`
    INSERT INTO news_sources
      (name, type, url, rss_url, api_provider, query, category, country, is_active, reliability_score, fetch_interval_minutes, is_official, priority)
    VALUES (
      ${input.name.trim()}, ${input.type}, ${(input.url || "").trim()}, ${(input.rssUrl || "").trim()},
      ${providerFor(input.type)}, ${(input.query || "").trim()}, ${(input.category || "").trim()}, ${(input.country || "").trim()},
      ${input.isActive !== false}, ${Math.round(Number(input.reliabilityScore ?? 50))}, ${Math.round(Number(input.fetchIntervalMinutes ?? 30))},
      ${!!input.isOfficial}, ${Math.round(Number(input.priority ?? DEFAULT_PRIORITY))}
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
      is_official = ${!!input.isOfficial},
      priority = ${Math.round(Number(input.priority ?? DEFAULT_PRIORITY))},
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
// Official sources arrive inactive, for an editor to review.
export async function loadDefaultNewsSources(): Promise<{ added: number; official: number }> {
  let added = 0;
  let official = 0;
  for (const s of [...DEFAULT_NEWS_SOURCES, ...MORE_NEWS_SOURCES, ...OFFICIAL_NEWS_SOURCES]) {
    const rows = await sql`
      INSERT INTO news_sources
        (name, type, url, rss_url, api_provider, query, category, country, is_active, reliability_score, fetch_interval_minutes, is_official, priority)
      VALUES (${s.name}, ${s.type}, ${s.url}, ${s.rssUrl}, ${s.apiProvider}, ${s.query}, ${s.category}, ${s.country},
              ${s.isActive}, ${s.reliabilityScore}, ${s.fetchIntervalMinutes}, ${s.isOfficial}, ${s.priority})
      ON CONFLICT (lower(rss_url)) WHERE rss_url <> '' DO NOTHING
      RETURNING id
    `;
    added += rows.length;
    if (s.isOfficial) official += rows.length;
  }
  return { added, official };
}
