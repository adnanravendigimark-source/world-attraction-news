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
      ...t(20, "nonstop", "nonstop route", "nonstop flights"),
      ...t(12, "standby", "fares", "frequent flyer", "loyalty program", "lounge", "cabin", "seat upgrade", "upgrades"),
    ],
    Rail: [
      ...t(20, "train", "trains", "rail service", "railway", "high-speed rail", "amtrak", "eurostar", "sleeper train"),
      ...t(12, "rail", "round trip", "station", "timetable"),
    ],
    "Travel Rules": [
      ...t(25, "travel advice", "advises against", "do not travel", "reconsider travel", "travel warning", "travel notice", "travel alert"),
      ...t(20, "exercise increased caution", "essential travel", "travel health"),
      ...t(25, "visa", "visas", "entry requirements", "entry rules", "entry fee", "tourist tax", "travel ban", "travel advisory", "passport", "border control", "e-visa", "eta", "etias", "customs", "quarantine"),
      ...t(12, "immigration", "residency requirement", "vaccination requirement", "travel rules", "outbreak", "vaccination", "travelers' health"),
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
    ...t(30, "iphone", "smartphone", "laptop", "software update", "chatbot", "video game", "movie review", "tv series", "parliament", "senate", "congress", "prime minister said", "president said", "political party", "stock price", "shares fell", "shares rose", "earnings per share", "quarterly earnings", "iphone", "android phone", "box office", "celebrity", "transfer window", "premier league", "nba", "nfl", "cryptocurrency", "bitcoin", "election results", "campaign rally", "lawsuit settlement",
      "financial results", "investor conference", "webcast", "conference call", "shareholders", "dividend", "board of directors", "internship program"),
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

export async function saveFilterConfig(config: FilterConfig): Promise<FilterConfig> {
  await sql`
    INSERT INTO news_settings (key, value, updated_at) VALUES ('filter', ${JSON.stringify(config)}::jsonb, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
  `;
  cache = null;
  return config;
}

export async function resetFilterConfig(): Promise<FilterConfig> {
  await sql`DELETE FROM news_settings WHERE key = 'filter'`;
  cache = null;
  return DEFAULT_FILTER_CONFIG;
}

// Cleans and checks an edited config. Returns the config to save, or an error.
export function normalizeFilterConfig(raw: any): { config?: FilterConfig; error?: string } {
  if (!raw || typeof raw !== "object") return { error: "Invalid request." };
  const relevantMin = Number(raw.relevantMin);
  const borderlineMin = Number(raw.borderlineMin);
  if (!Number.isInteger(relevantMin) || relevantMin < 1 || relevantMin > 100) return { error: "Travel news threshold must be 1–100." };
  if (!Number.isInteger(borderlineMin) || borderlineMin < 0 || borderlineMin >= relevantMin) return { error: "Weak threshold must be 0 or more and below the travel news threshold." };
  const cleanTerms = (list: any, label: string): FilterTerm[] | string => {
    if (!Array.isArray(list)) return `${label}: expected a list of terms.`;
    const seen = new Set<string>();
    const out: FilterTerm[] = [];
    for (const x of list) {
      const term = String(x?.term ?? "").trim().toLowerCase();
      const weight = Number(x?.weight);
      if (!term) continue;
      if (term.length > 60) return `${label}: "${term.slice(0, 20)}…" is too long.`;
      if (!Number.isFinite(weight) || weight < 1 || weight > 100) return `${label}: weight for "${term}" must be 1–100.`;
      if (seen.has(term)) continue;
      seen.add(term);
      out.push({ term, weight: Math.round(weight) });
    }
    return out;
  };
  const categories: Record<string, FilterTerm[]> = {};
  if (!raw.categories || typeof raw.categories !== "object") return { error: "Categories are missing." };
  for (const [name, list] of Object.entries(raw.categories)) {
    const key = String(name).trim();
    if (!key) continue;
    const terms = cleanTerms(list, key);
    if (typeof terms === "string") return { error: terms };
    if (terms.length) categories[key] = terms;
  }
  if (Object.keys(categories).length === 0) return { error: "Keep at least one category with terms." };
  const negatives = cleanTerms(raw.negatives ?? [], "Off-topic terms");
  if (typeof negatives === "string") return { error: negatives };
  const sourceBonus = Number(raw.sourceBonus ?? DEFAULT_FILTER_CONFIG.sourceBonus);
  return { config: { relevantMin, borderlineMin, sourceBonus: Number.isFinite(sourceBonus) ? sourceBonus : 0, categories, negatives } };
}

// Points an official source's item gains once it names a travel term.
export const OFFICIAL_BONUS = 25;

export interface RelevanceResult {
  score: number;
  base: number; // score before an official source's bonus (used for travel impact in trend scoring)
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
  input: { title: string; description?: string; sourceCategory?: string; sourceIsTravel?: boolean; sourceIsOfficial?: boolean },
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
  let score = Math.max(0, Math.min(100, Math.round(total + bonus - penalty)));
  // An official source speaking about itself (an airline about its flights,
  // a government about entry rules) gets a lift once it names anything
  // travel-related, enough to carry a real travel item over the line but not
  // a staff profile that merely mentions the brand's hotels. Every entry of an
  // official travel-advice feed is travel news. Off-topic vocabulary (results
  // webcasts, board news) still rules an item out.
  let officialLift = false;
  let base = score;
  if (input.sourceIsOfficial && penalty === 0) {
    if (input.sourceCategory === "Travel Rules") {
      officialLift = score < config.relevantMin;
      score = Math.max(score, config.relevantMin);
      base = score; // an advisory is travel news on its own merits
    } else if (total > 0) {
      officialLift = true;
      score = Math.min(100, score + OFFICIAL_BONUS);
    }
  }
  const topCat = Object.entries(catScores).sort((a, b) => b[1] - a[1])[0]?.[0] || (officialLift ? input.sourceCategory || "" : "");
  const status = score >= config.relevantMin ? "relevant" : score >= config.borderlineMin ? "borderline" : "irrelevant";

  const reason = [
    hits.length ? `matched: ${[...new Set(hits)].slice(0, 6).join(", ")}` : "no travel terms",
    negHits.length ? `off-topic: ${[...new Set(negHits)].slice(0, 4).join(", ")}` : "",
    officialLift ? "official source" : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return { score, base, category: topCat, status, reason };
}

// Re-score stored items (e.g. after editing the term lists). `onlyPending`
// limits it to rows never filtered. Processes in batches via unnest.
export async function refilterItems(opts: { onlyPending?: boolean; limit?: number } = {}): Promise<number> {
  const config = await loadFilterConfig();
  const limit = Math.min(opts.limit ?? 2000, 5000);
  const rows = await sql`
    SELECT i.id, i.title, i.description, s.category AS source_category, s.type AS source_type, s.is_official
    FROM news_items i JOIN news_sources s ON s.id = i.source_id
    WHERE (${!!opts.onlyPending} = false OR i.filter_status = 'pending')
    ORDER BY i.created_at DESC
    LIMIT ${limit}
  `;
  let done = 0;
  for (let n = 0; n < rows.length; n += 200) {
    const batch = rows.slice(n, n + 200);
    const res = batch.map((r: any) =>
      scoreRelevance(
        {
          title: r.title,
          description: r.description,
          sourceCategory: r.source_category,
          sourceIsTravel: isTravelSource(r.source_type, r.source_category),
          sourceIsOfficial: isOfficialFeed(r.source_type, r.is_official),
        },
        config
      )
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
    await sql`
      UPDATE news_items i SET relevance_base = t.base
      FROM unnest(${batch.map((r: any) => r.id)}::uuid[], ${res.map((r) => r.base)}::int[]) AS t(id, base)
      WHERE i.id = t.id
    `.catch(() => {}); // column arrives with scripts/setup-db.mjs
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

// A source flagged official, publishing its own news (never an aggregator).
export function isOfficialFeed(type: string, isOfficial: unknown): boolean {
  return !!isOfficial && type !== "google_news_rss" && type !== "newsapi" && type !== "currents";
}
