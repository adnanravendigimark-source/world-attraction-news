import { sql } from "../db";
import { loadFilterConfig } from "./filter";

export interface StoryItem {
  id: string;
  title: string;
  url: string;
  publisher: string;
  sourceName: string;
  reliabilityScore: number;
  publishedAt: string | null;
}

export interface Story {
  id: string;
  title: string;
  category: string;
  itemCount: number;
  sourceCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  publishedFirstAt: string | null;
  trendScore: number | null;
  status: string;
  trendBreakdown: {
    freshness: number; sources: number; impact: number; audience: number; reliability: number; uniqueness: number;
    total: number; tier: "high" | "review" | "low"; notes: string[];
  } | null;
  relevanceReason: string; // why the best item scored as it did
  relevance: number; // best travel-relevance score (0–100) among the story's items
  researchStatus: string; // '' | running | done | failed
  items: StoryItem[];
}

const iso = (v: unknown): string | null => (v ? (v instanceof Date ? v.toISOString() : String(v)) : null);

export interface StoryFunnel {
  itemsCollected: number; // items fetched in the scoring window
  itemsTravel: number; // of those, clearly travel-related
  storiesTravel: number; // distinct travel stories after grouping
  windowDays: number;
}

export async function listStories(
  opts: { q?: string; category?: string; minSources?: number; status?: string; limit?: number } = {}
): Promise<{ stories: Story[]; total: number; funnel: StoryFunnel }> {
  const q = (opts.q || "").trim();
  const like = q ? `%${q.replace(/[%_\\]/g, (c) => "\\" + c)}%` : "";
  const category = opts.category || "";
  const minSources = Math.max(1, opts.minSources ?? 1);
  const status = opts.status ?? "";
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const minRel = (await loadFilterConfig()).relevantMin;

  // Only stories with at least one clearly travel-related item are ever listed.
  const clusters = (await sql`
    SELECT c.*, (SELECT COALESCE(MAX(i.relevance_score), 0)::int FROM news_items i WHERE i.cluster_id = c.id) AS max_relevance,
           (SELECT i.filter_reason FROM news_items i WHERE i.cluster_id = c.id ORDER BY i.relevance_score DESC NULLS LAST LIMIT 1) AS rel_reason
    FROM story_clusters c
    WHERE EXISTS (SELECT 1 FROM news_items i WHERE i.cluster_id = c.id AND i.relevance_score >= ${minRel})
      AND (${like} = '' OR canonical_title ILIKE ${like})
      AND (${category} = '' OR category = ${category})
      AND source_count >= ${minSources}
      AND ((${status} = '' AND status <> 'ignored') OR (${status} <> '' AND status = ${status}))
    ORDER BY trend_score DESC NULLS LAST, max_relevance DESC, source_count DESC, last_seen_at DESC
    LIMIT ${limit}
  `) as any[];
  const total = Number(
    (await sql`
      SELECT COUNT(*)::int AS n FROM story_clusters c
      WHERE EXISTS (SELECT 1 FROM news_items i WHERE i.cluster_id = c.id AND i.relevance_score >= ${minRel})
        AND (${like} = '' OR canonical_title ILIKE ${like}) AND (${category} = '' OR category = ${category}) AND source_count >= ${minSources}
        AND ((${status} = '' AND status <> 'ignored') OR (${status} <> '' AND status = ${status}))
    `)[0]?.n ?? 0
  );
  const fr = (await sql`
    SELECT COUNT(*)::int AS collected,
           COUNT(*) FILTER (WHERE relevance_score >= ${minRel})::int AS travel
    FROM news_items WHERE COALESCE(published_at, created_at) > now() - interval '7 days'
  `.catch(() => [{ collected: 0, travel: 0 }]))[0] as any;
  const funnel: StoryFunnel = { itemsCollected: Number(fr?.collected ?? 0), itemsTravel: Number(fr?.travel ?? 0), storiesTravel: total, windowDays: 7 };
  if (clusters.length === 0) return { stories: [], total, funnel };

  const ids = clusters.map((c) => c.id);
  const items = (await sql`
    SELECT i.id, i.cluster_id, i.title, i.url, i.published_at, i.created_at,
           s.name AS source_name, s.reliability_score,
           CASE WHEN s.type = 'google_news_rss' AND i.author <> '' THEN i.author ELSE s.name END AS publisher
    FROM news_items i JOIN news_sources s ON s.id = i.source_id
    WHERE i.cluster_id = ANY(${ids}::uuid[])
    ORDER BY COALESCE(i.published_at, i.created_at) ASC
  `) as any[];

  const rs = (await sql`
    SELECT DISTINCT ON (cluster_id) cluster_id, status FROM story_research
    WHERE cluster_id = ANY(${ids}::uuid[]) ORDER BY cluster_id, created_at DESC
  `.catch(() => [])) as any[];
  const researchBy = new Map(rs.map((r) => [r.cluster_id, r.status as string]));

  const byCluster = new Map<string, StoryItem[]>();
  for (const r of items) {
    const list = byCluster.get(r.cluster_id) || [];
    list.push({
      id: r.id,
      title: r.title,
      url: r.url || "",
      publisher: r.publisher,
      sourceName: r.source_name,
      reliabilityScore: Number(r.reliability_score ?? 50),
      publishedAt: iso(r.published_at || r.created_at),
    });
    byCluster.set(r.cluster_id, list);
  }

  return {
    total,
    funnel,
    stories: clusters.map((c) => ({
      id: c.id,
      title: c.canonical_title,
      category: c.category || "",
      itemCount: c.item_count,
      sourceCount: c.source_count,
      firstSeenAt: iso(c.first_seen_at) || "",
      lastSeenAt: iso(c.last_seen_at) || "",
      publishedFirstAt: iso(c.published_first_at),
      trendScore: c.trend_score == null ? null : Number(c.trend_score),
      status: c.status,
      trendBreakdown: c.trend_breakdown || null,
      relevance: Number(c.max_relevance ?? 0),
      relevanceReason: String(c.rel_reason || ""),
      researchStatus: researchBy.get(c.id) || "",
      items: byCluster.get(c.id) || [],
    })),
  };
}
