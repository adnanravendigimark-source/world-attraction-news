// Phase 3 — cheap, deterministic travel-relevance scoring. Runs BEFORE any
// AI step so only plausible travel stories move on. No network, no LLM.
//
// Score 0–100 from weighted keyword hits (title counts 1.5×), a small bonus
// when the source is itself travel-focused, minus penalties for clearly
// off-topic vocabulary. Thresholds and term lists can be overridden through
// the `news_settings` table (key = "filter"); defaults live here.
import { sql } from "../db";

export type FilterStatus = "pending" | "relevant" | "borderline" | "irrelevant";

export interface FilterTerm {
  term: string;
  weight: number;
}

export interface FilterConfig {
  relevantMin: number;
  borderlineMin: number;
  sourceBonus: number;
  categories: Record<string, FilterTerm[]>;
  negatives: FilterTerm[];
}

const t = (weight: number, ...terms: string[]): FilterTerm[] => terms.map((term) => ({ term, weight }));

export const DEFAULT_FILTER_CONFIG: FilterConfig = {
  relevantMin: 60, // 60+ = travel news; 40–59 weak (excluded); below 40 not travel
  borderlineMin: 40,
  sourceBonus: 0, // the text decides, never the source or its category
  categories: {
    Aviation: [
      ...t(20, "airline", "airlines", "airport", "airports", "flight", "flights", "new route", "air traffic", "terminal"),
      ...t(12, "aircraft", "boarding", "baggage", "carry-on", "runway", "airfare", "layover", "codeshare"),
    ],
    "Travel Rules": [
      ...t(25, "visa", "visas", "entry requirements", "entry rules", "entry fee", "tourist tax", "travel ban", "travel advisory", "passport", "border control", "e-visa", "eta", "etias", "customs", "quarantine"),
      ...t(12, "immigration", "residency requirement", "vaccination requirement", "travel rules"),
    ],
    Attractions: [
      ...t(22, "attraction", "attractions", "museum", "theme park", "landmark", "unesco", "world heritage", "national park", "observation deck", "zoo", "aquarium", "amusement park"),
      ...t(14, "opens to visitors", "reopens", "ticket", "tickets", "visitor", "visitors", "sightseeing", "monument", "cathedral", "palace"),
    ],
    Hotels: [
      ...t(20, "hotel", "hotels", "resort", "resorts", "hostel", "accommodation"),
      ...t(10, "hotel chain", "check-in", "occupancy"),
    ],
    Cruises: [...t(22, "cruise", "cruises", "cruise ship", "cruise line", "port of call", "sailing"), ...t(10, "ferry")],
    Tourism: [
      ...t(18, "tourism", "tourist", "tourists", "traveler", "travelers", "traveller", "travellers", "holiday", "vacation", "destination", "destinations", "overtourism", "tour operator", "travel industry"),
      ...t(10, "trip", "getaway", "itinerary", "sightseeing"),
    ],
    Destinations: [...t(12, "city break", "beach", "island", "old town", "travel guide", "best time to visit", "things to do")],
  },
  negatives: [
    ...t(30, "iphone", "smartphone", "laptop", "software update", "chatbot", "video game", "movie review", "tv series", "parliament", "senate", "congress", "prime minister said", "president said", "political party", "stock price", "shares fell", "shares rose", "earnings per share", "quarterly earnings", "iphone", "android phone", "box office", "celebrity", "transfer window", "premier league", "nba", "nfl", "cryptocurrency", "bitcoin", "election results", "campaign rally", "lawsuit settlement"),
    ...t(12, "football", "soccer", "basketball", "baseball", "recipe", "horoscope", "stock market"),
  ],
};

let cache: { config: FilterConfig; at: number } | null = null;

export async function loadFilterConfig(): Promise<FilterConfig> {
  if (cache && Date.now() - cache.at < 60_000) return cache.config;
  let config = DEFAULT_FILTER_CONFIG;
  try {
    const rows = await sql`SELECT value FROM news_settings WHERE key = 'filter' LIMIT 1`;
    if (rows[0]?.value) config = { ...DEFAULT_FILTER_CONFIG, ...rows[0].value };
  } catch {
    /* table may not exist yet — defaults are fine */
  }
  cache = { config, at: Date.now() };
  return config;
}

export interface RelevanceResult {
  score: number;
  category: string;
  status: Exclude<FilterStatus, "pending">;
  reason: string;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const reCache = new Map<string, RegExp>();
function termRe(term: string): RegExp {
  let re = reCache.get(term);
  if (!re) {
    re = new RegExp(`(^|[^a-z0-9])${escapeRe(term.toLowerCase())}([^a-z0-9]|$)`);
    reCache.set(term, re);
  }
  return re;
}

export function scoreRelevance(
  input: { title: string; description?: string; sourceCategory?: string; sourceIsTravel?: boolean },
  config: FilterConfig = DEFAULT_FILTER_CONFIG
): RelevanceResult {
  const title = ` ${input.title.toLowerCase()} `;
  const body = ` ${(input.description || "").toLowerCase()} `;

  const catScores: Record<string, number> = {};
  const hits: string[] = [];
  let total = 0;

  for (const [cat, terms] of Object.entries(config.categories)) {
    let s = 0;
    for (const { term, weight } of terms) {
      const re = termRe(term);
      if (re.test(title)) {
        s += weight * 1.5;
        hits.push(term);
      } else if (re.test(body)) {
        s += weight;
        hits.push(term);
      }
    }
    if (s > 0) {
      catScores[cat] = s;
      total += s;
    }
  }

  let penalty = 0;
  const negHits: string[] = [];
  for (const { term, weight } of config.negatives) {
    const re = termRe(term);
    if (re.test(title) || re.test(body)) {
      penalty += weight;
      negHits.push(term);
    }
  }

  const bonus = input.sourceIsTravel && total > 0 ? config.sourceBonus : 0;
  const score = Math.max(0, Math.min(100, Math.round(total + bonus - penalty)));
  const topCat = Object.entries(catScores).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
  const status = score >= config.relevantMin ? "relevant" : score >= config.borderlineMin ? "borderline" : "irrelevant";

  const reason = [
    hits.length ? `matched: ${[...new Set(hits)].slice(0, 6).join(", ")}` : "no travel terms",
    negHits.length ? `off-topic: ${[...new Set(negHits)].slice(0, 4).join(", ")}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return { score, category: topCat, status, reason };
}

// Re-score stored items (e.g. after editing the term lists). `onlyPending`
// limits it to rows never filtered. Processes in batches via unnest.
export async function refilterItems(opts: { onlyPending?: boolean; limit?: number } = {}): Promise<number> {
  const config = await loadFilterConfig();
  const limit = Math.min(opts.limit ?? 2000, 5000);
  const rows = await sql`
    SELECT i.id, i.title, i.description, s.category AS source_category, s.type AS source_type
    FROM news_items i JOIN news_sources s ON s.id = i.source_id
    WHERE (${!!opts.onlyPending} = false OR i.filter_status = 'pending')
    ORDER BY i.created_at DESC
    LIMIT ${limit}
  `;
  let done = 0;
  for (let n = 0; n < rows.length; n += 200) {
    const batch = rows.slice(n, n + 200);
    const res = batch.map((r: any) =>
      scoreRelevance({ title: r.title, description: r.description, sourceCategory: r.source_category, sourceIsTravel: isTravelSource(r.source_type, r.source_category) }, config)
    );
    await sql`
      UPDATE news_items i SET relevance_score = t.score, relevance_category = t.cat, filter_status = t.status, filter_reason = t.reason
      FROM unnest(
        ${batch.map((r: any) => r.id)}::uuid[],
        ${res.map((r) => r.score)}::int[],
        ${res.map((r) => r.category)}::text[],
        ${res.map((r) => r.status)}::text[],
        ${res.map((r) => r.reason)}::text[]
      ) AS t(id, score, cat, status, reason)
      WHERE i.id = t.id
    `;
    done += batch.length;
  }
  return done;
}

// Google News queries and API queries are already travel-targeted; dedicated
// travel publications count too. Everything gets the bonus only if it also
// matched a travel term, so a "travel source" can't rescue off-topic items.
export function isTravelSource(type: string, category: string): boolean {
  return type === "google_news_rss" || type === "newsapi" || type === "currents" || !!category;
}
