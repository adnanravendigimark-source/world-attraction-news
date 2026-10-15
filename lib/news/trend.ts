// Phase 5 — trend scoring. Ranks story clusters 0–100 from six factors.
// Weights, freshness bands, category weights and tier thresholds all live in
// `news_settings` (key "trend") with defaults below, so editors can tune them
// without a deploy. Every factor is stored per story for transparency.
import { sql } from "../db";
import { prepareTitle, sameStoryPrepared } from "./similarity";

export interface TrendConfig {
  weights: { freshness: number; sources: number; impact: number; audience: number; reliability: number; uniqueness: number };
  // [maxAgeHours, score] pairs, ascending. Older than the last band → `staleScore`.
  freshnessBands: [number, number][];
  staleScore: number;
  // Score for 1,2,3,4,5+ distinct publishers.
  sourceCurve: number[];
  categoryWeights: Record<string, number>;
  defaultCategoryWeight: number;
  thresholds: { high: number; review: number };
  windowDays: number; // stories trend-scored (last N days)
  // How far back news is collected and listed on the Trending News desk.
  collectDays: number;
}

// Choices offered in the admin for collectDays.
export const COLLECT_DAY_OPTIONS = [1, 2, 3, 7, 14] as const;

export const DEFAULT_TREND_CONFIG: TrendConfig = {
  // Phase 6: story size (publishers) weighs as much as freshness, so a story
  // eight outlets are covering outranks a brand's own post from an hour ago.
  weights: { freshness: 25, sources: 25, impact: 20, audience: 10, reliability: 15, uniqueness: 5 },
  freshnessBands: [
    [2, 100],
    [6, 85],
    [12, 65],
    [24, 45],
    [48, 25],
  ],
  staleScore: 8,
  sourceCurve: [20, 50, 75, 90, 100],
  categoryWeights: {
    "Travel Rules": 100,
    Aviation: 80,
    Attractions: 80,
    Destinations: 70,
    Cruises: 65,
    Hotels: 60,
    Tourism: 60,
  },
  defaultCategoryWeight: 40,
  // Calibrated on a week of real scores (October 2026, 116 stories): 60+ is
  // roughly the top 7%, 50+ the top 18%. The Calibration panel suggests new
  // values from editors' own picks once there are enough of them.
  thresholds: { high: 60, review: 50 },
  windowDays: 7,
  collectDays: 3,
};

// Days of news to collect and list; always one of COLLECT_DAY_OPTIONS.
export function clampCollectDays(v: unknown): number {
  const n = Math.round(Number(v));
  return (COLLECT_DAY_OPTIONS as readonly number[]).includes(n) ? n : DEFAULT_TREND_CONFIG.collectDays;
}

export async function newsWindowDays(): Promise<number> {
  return clampCollectDays((await loadTrendConfig()).collectDays);
}

export interface TrendBreakdown {
  freshness: number;
  sources: number;
  impact: number;
  audience: number;
  reliability: number;
  uniqueness: number;
  total: number;
  tier: "high" | "review" | "low";
  notes: string[];
}

let cache: { config: TrendConfig; at: number } | null = null;

export async function loadTrendConfig(force = false): Promise<TrendConfig> {
  if (!force && cache && Date.now() - cache.at < 30_000) return cache.config;
  let config = DEFAULT_TREND_CONFIG;
  try {
    const rows = await sql`SELECT value FROM news_settings WHERE key = 'trend' LIMIT 1`;
    const v = rows[0]?.value;
    if (v) {
      config = {
        ...DEFAULT_TREND_CONFIG,
        ...v,
        weights: { ...DEFAULT_TREND_CONFIG.weights, ...(v.weights || {}) },
        thresholds: { ...DEFAULT_TREND_CONFIG.thresholds, ...(v.thresholds || {}) },
        categoryWeights: { ...DEFAULT_TREND_CONFIG.categoryWeights, ...(v.categoryWeights || {}) },
      };
    }
  } catch {
    /* table may not exist yet */
  }
  cache = { config, at: Date.now() };
  return config;
}

export async function saveTrendConfig(patch: Partial<TrendConfig>): Promise<TrendConfig> {
  const current = await loadTrendConfig(true);
  const next: TrendConfig = {
    ...current,
    ...(patch.freshnessBands ? { freshnessBands: patch.freshnessBands.map(([h, v]) => [Number(h), Number(v)] as [number, number]) } : {}),
    ...(patch.staleScore !== undefined ? { staleScore: Number(patch.staleScore) } : {}),
    ...(patch.sourceCurve ? { sourceCurve: patch.sourceCurve.map(Number) } : {}),
    ...(patch.collectDays !== undefined ? { collectDays: clampCollectDays(patch.collectDays) } : {}),
    weights: { ...current.weights, ...(patch.weights || {}) },
    thresholds: { ...current.thresholds, ...(patch.thresholds || {}) },
    categoryWeights: { ...current.categoryWeights, ...(patch.categoryWeights || {}) },
  };
  await sql`
    INSERT INTO news_settings (key, value, updated_at) VALUES ('trend', ${JSON.stringify(next)}::jsonb, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
  `;
  cache = null;
  return next;
}

export function validateTrendPatch(p: any): string | null {
  if (!p || typeof p !== "object") return "Invalid request.";
  if (p.weights) {
    for (const [k, v] of Object.entries(p.weights)) {
      if (!(k in DEFAULT_TREND_CONFIG.weights)) return `Unknown weight "${k}".`;
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0 || n > 100) return "Weights must be between 0 and 100.";
    }
    const sum = Object.values({ ...DEFAULT_TREND_CONFIG.weights, ...p.weights }).reduce((a: number, b: any) => a + Number(b), 0);
    if (sum <= 0) return "At least one weight must be above 0.";
  }
  if (p.thresholds) {
    const h = Number(p.thresholds.high ?? DEFAULT_TREND_CONFIG.thresholds.high);
    const r = Number(p.thresholds.review ?? DEFAULT_TREND_CONFIG.thresholds.review);
    if (![h, r].every((n) => Number.isFinite(n) && n >= 0 && n <= 100)) return "Thresholds must be between 0 and 100.";
    if (r > h) return "The review threshold can't be higher than the high-priority threshold.";
  }
  if (p.collectDays !== undefined && !(COLLECT_DAY_OPTIONS as readonly number[]).includes(Number(p.collectDays))) {
    return `Collect news for ${COLLECT_DAY_OPTIONS.join(", ")} days.`;
  }
  if (p.freshnessBands !== undefined) {
    const b = p.freshnessBands;
    if (!Array.isArray(b) || b.length < 1 || b.length > 8) return "Freshness needs 1 to 8 bands.";
    let prevAge = 0;
    let prevScore = 101;
    for (const band of b) {
      const [h, v] = Array.isArray(band) ? band.map(Number) : [NaN, NaN];
      if (!Number.isFinite(h) || h <= prevAge || h > 24 * 30) return "Freshness band ages must increase (hours, up to 720).";
      if (!Number.isFinite(v) || v < 0 || v > 100 || v > prevScore) return "Freshness band scores must be 0–100 and must not rise for older stories.";
      prevAge = h;
      prevScore = v;
    }
    const stale = Number(p.staleScore ?? 0);
    if (!Number.isFinite(stale) || stale < 0 || stale > prevScore) return "The score for older stories must be 0 or more and not above the last band.";
  }
  if (p.sourceCurve !== undefined) {
    const c = p.sourceCurve;
    if (!Array.isArray(c) || c.length !== 5) return "The source curve needs 5 values (1, 2, 3, 4, 5+ publishers).";
    let prev = -1;
    for (const v of c.map(Number)) {
      if (!Number.isFinite(v) || v < 0 || v > 100 || v < prev) return "Source curve values must be 0–100 and must not fall as publishers increase.";
      prev = v;
    }
  }
  return null;
}

// ---- Pure scoring ----------------------------------------------------------

export function freshnessScore(ageHours: number, cfg: TrendConfig): number {
  for (const [maxAge, score] of cfg.freshnessBands) if (ageHours <= maxAge) return score;
  return cfg.staleScore;
}

export function sourceCountScore(n: number, cfg: TrendConfig): number {
  const curve = cfg.sourceCurve;
  return curve[Math.min(Math.max(n, 1), curve.length) - 1] ?? 100;
}

export interface ClusterFacts {
  newestAt: Date;
  sourceCount: number;
  category: string;
  maxRelevance: number; // 0–100
  maxReliability: number;
  avgReliability: number;
  matchesCoverage: boolean; // names a country/city the site covers
  duplicatesPublished: boolean; // we've already published this story
  official?: boolean; // at least one item comes from a source marked official
}

// An official source vouches for the story, so reliability is at least this.
export const OFFICIAL_RELIABILITY = 90;

export function scoreCluster(f: ClusterFacts, cfg: TrendConfig, now = Date.now()): TrendBreakdown {
  const ageHours = Math.max(0, (now - f.newestAt.getTime()) / 3_600_000);
  const freshness = freshnessScore(ageHours, cfg);
  const sources = sourceCountScore(f.sourceCount, cfg);
  const catW = cfg.categoryWeights[f.category] ?? cfg.defaultCategoryWeight;
  const impact = Math.round(0.5 * f.maxRelevance + 0.5 * catW);
  const audience = f.matchesCoverage ? 100 : 40;
  const blended = Math.round(0.6 * f.maxReliability + 0.4 * f.avgReliability);
  const reliability = f.official ? Math.max(blended, OFFICIAL_RELIABILITY) : blended;
  const uniqueness = f.duplicatesPublished ? 0 : 100;

  const w = cfg.weights;
  const wsum = w.freshness + w.sources + w.impact + w.audience + w.reliability + w.uniqueness || 1;
  let total = Math.round(
    (freshness * w.freshness + sources * w.sources + impact * w.impact + audience * w.audience + reliability * w.reliability + uniqueness * w.uniqueness) / wsum
  );
  // Travel relevance is the gate: a fresh, widely reported story that is only
  // loosely about travel must not outrank a clearly travel-focused one.
  const relevanceFactor = Math.min(1, Math.max(0.2, f.maxRelevance / 70));
  total = Math.round(total * relevanceFactor);
  // A story we've already published must never surface as a recommendation.
  if (f.duplicatesPublished) total = Math.min(total, Math.max(0, cfg.thresholds.review - 1));
  const tier = total >= cfg.thresholds.high ? "high" : total >= cfg.thresholds.review ? "review" : "low";

  const notes = [
    `travel relevance ${f.maxRelevance}/100`,
    `newest item ${ageHours < 1 ? "<1" : Math.round(ageHours)}h old`,
    `${f.sourceCount} source${f.sourceCount === 1 ? "" : "s"}`,
    f.matchesCoverage ? "covers a place on this site" : "no match to site coverage",
  ];
  if (f.official) notes.push("official source");
  if (f.duplicatesPublished) notes.push("already published");

  return { freshness, sources, impact, audience, reliability, uniqueness, total, tier, notes };
}

// ---- DB runner -------------------------------------------------------------

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export async function runTrendScoring(): Promise<{ scored: number }> {
  const cfg = await loadTrendConfig(true);

  const clusters = (await sql`
    SELECT id, canonical_title, category, source_count, last_seen_at, published_first_at
    FROM story_clusters
    WHERE last_seen_at > now() - (${cfg.windowDays}::int * interval '1 day') AND status <> 'merged'
  `) as any[];
  if (clusters.length === 0) return { scored: 0 };
  const ids = clusters.map((c) => c.id);

  const stats = (await sql`
    SELECT i.cluster_id,
           MAX(COALESCE(i.relevance_base, i.relevance_score, 0))::int AS max_rel,
           MAX(s.reliability_score)::int AS max_rely,
           AVG(s.reliability_score)::float AS avg_rely,
           BOOL_OR(s.is_official AND s.type NOT IN ('google_news_rss', 'newsapi', 'currents')) AS official,
           MAX(COALESCE(i.published_at, i.created_at)) AS newest_at
    FROM news_items i JOIN news_sources s ON s.id = i.source_id
    WHERE i.cluster_id = ANY(${ids}::uuid[])
    GROUP BY i.cluster_id
  `.catch(
    // Before scripts/setup-db.mjs adds is_official / relevance_base.
    () => sql`
    SELECT i.cluster_id,
           MAX(COALESCE(i.relevance_score, 0))::int AS max_rel,
           MAX(s.reliability_score)::int AS max_rely,
           AVG(s.reliability_score)::float AS avg_rely,
           false AS official,
           MAX(COALESCE(i.published_at, i.created_at)) AS newest_at
    FROM news_items i JOIN news_sources s ON s.id = i.source_id
    WHERE i.cluster_id = ANY(${ids}::uuid[])
    GROUP BY i.cluster_id
  `
  )) as any[];
  const byId = new Map(stats.map((r) => [r.cluster_id, r]));

  // Places this site covers (countries + cities) for the audience factor.
  const places = (await sql`SELECT name FROM countries UNION SELECT name FROM cities`) as any[];
  const placeRe = places.length
    ? new RegExp(`(^|[^a-z0-9])(${places.map((p) => escapeRe(String(p.name).toLowerCase())).join("|")})([^a-z0-9]|$)`)
    : null;

  // Recently published articles, to avoid re-covering a story we've already run.
  const published = (await sql`
    SELECT title FROM articles WHERE status = 'published' AND published_at > now() - interval '30 days'
  `) as any[];
  const publishedPrepared = published.map((a) => prepareTitle(String(a.title)));

  const scored: { id: string; total: number; breakdown: TrendBreakdown }[] = [];
  for (const c of clusters) {
    const st = byId.get(c.id);
    if (!st) continue;
    const title = String(c.canonical_title);
    const p = prepareTitle(title);
    const facts: ClusterFacts = {
      newestAt: new Date(st.newest_at || c.last_seen_at),
      sourceCount: Number(c.source_count || 1),
      category: c.category || "",
      maxRelevance: Number(st.max_rel || 0),
      maxReliability: Number(st.max_rely || 50),
      avgReliability: Number(st.avg_rely || 50),
      matchesCoverage: !!placeRe && placeRe.test(title.toLowerCase()),
      duplicatesPublished: publishedPrepared.some((q) => sameStoryPrepared(p, q)),
      official: !!st.official,
    };
    const breakdown = scoreCluster(facts, cfg);
    scored.push({ id: c.id, total: breakdown.total, breakdown });
  }

  for (let n = 0; n < scored.length; n += 200) {
    const batch = scored.slice(n, n + 200);
    await sql`
      UPDATE story_clusters c SET trend_score = t.score, trend_breakdown = t.bd::jsonb, trend_scored_at = now()
      FROM unnest(${batch.map((b) => b.id)}::uuid[], ${batch.map((b) => b.total)}::int[], ${batch.map((b) => JSON.stringify(b.breakdown))}::text[]) AS t(id, score, bd)
      WHERE c.id = t.id
    `;
  }
  return { scored: scored.length };
}
