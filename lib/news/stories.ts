import { sql } from "../db";
import { loadFilterConfig } from "./filter";
import { contentHash } from "./contentHash";
import { storyPipeline, type StoryPipeline } from "./stage";

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
  pipeline: StoryPipeline; // where the story stands: research, draft, check, image, published
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
      AND ((${status} = '' AND status NOT IN ('ignored', 'merged')) OR (${status} <> '' AND status = ${status}))
    ORDER BY trend_score DESC NULLS LAST, max_relevance DESC, source_count DESC, last_seen_at DESC
    LIMIT ${limit}
  `) as any[];
  const total = Number(
    (await sql`
      SELECT COUNT(*)::int AS n FROM story_clusters c
      WHERE EXISTS (SELECT 1 FROM news_items i WHERE i.cluster_id = c.id AND i.relevance_score >= ${minRel})
        AND (${like} = '' OR canonical_title ILIKE ${like}) AND (${category} = '' OR category = ${category}) AND source_count >= ${minSources}
        AND ((${status} = '' AND status NOT IN ('ignored', 'merged')) OR (${status} <> '' AND status = ${status}))
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

  // Pipeline state: the story's news article (with its fact check and image
  // rights) and its latest unfinished or failed job. Each query degrades to
  // "nothing yet" if a table or column isn't migrated.
  const arts = (await sql`
    SELECT DISTINCT ON (a.news_cluster_id) a.news_cluster_id, a.id, a.status, a.word_count, a.image, a.content_html, a.excerpt,
           c.verdict, c.overridden, c.content_hash, m.source_type, m.credit
    FROM articles a
    LEFT JOIN news_article_checks c ON c.article_id = a.id
    LEFT JOIN article_image_meta m ON m.article_id = a.id
    WHERE a.type = 'news' AND a.news_cluster_id = ANY(${ids}::uuid[])
    ORDER BY a.news_cluster_id, a.updated_at DESC
  `.catch(() => [])) as any[];
  const artBy = new Map(arts.map((r) => [r.news_cluster_id, r]));
  const jobs = (await sql`
    SELECT DISTINCT ON (cluster_id) cluster_id, kind, status, error FROM news_jobs
    WHERE cluster_id = ANY(${ids}::uuid[]) AND status IN ('queued', 'running', 'failed')
    ORDER BY cluster_id, id DESC
  `.catch(() => [])) as any[];
  const jobBy = new Map(jobs.map((r) => [r.cluster_id, r]));

  const pipelineFor = (clusterId: string): StoryPipeline => {
    const a = artBy.get(clusterId);
    const j = jobBy.get(clusterId);
    const html = String(a?.content_html || "");
    return storyPipeline({
      researchStatus: researchBy.get(clusterId) || "",
      job: j ? { kind: j.kind, status: j.status, error: j.error || "" } : null,
      article: a
        ? {
            id: a.id,
            status: a.status,
            wordCount: Number(a.word_count || 0),
            hasTodo: /TODO/.test(html) || /TODO/.test(String(a.excerpt || "")),
            hasImage: !!a.image,
            imageRightsOk: !!a.source_type && a.source_type !== "unverified" && (a.source_type === "ai" || !!String(a.credit || "").trim()),
          }
        : null,
      check: a?.verdict
        ? { verdict: a.verdict, overridden: !!a.overridden, stale: !!a.content_hash && a.content_hash !== contentHash(html) }
        : null,
    });
  };

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
      pipeline: pipelineFor(c.id),
      items: byCluster.get(c.id) || [],
    })),
  };
}
