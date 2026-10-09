// Numbers for the "Today's news" block on the admin overview. Read-only.
import { sql } from "../db";
import { newsPublishProblems } from "../articles";
import { loadTrendConfig } from "./trend";
import { listStories, type Story } from "./stories";

export interface NewsOverview {
  trending: number; // stories at or above the review threshold, seen in the last 24 h
  drafts: number; // AI news drafts not yet published or rejected
  ready: number; // drafts whose publish checks all pass
  publishedToday: number; // news published in the last 24 h
  top: Story[]; // highest-scoring open stories, with pipeline stage
}

const EMPTY: NewsOverview = { trending: 0, drafts: 0, ready: 0, publishedToday: 0, top: [] };
const OPEN_STATUSES = ["draft", "pending", "under_review", "changes_requested", "approved"];

export async function getNewsOverview(): Promise<NewsOverview> {
  try {
    const cfg = await loadTrendConfig();
    const [trend, draftCount, drafts, published, stories] = await Promise.all([
      sql`SELECT COUNT(*)::int AS n FROM story_clusters
          WHERE status <> 'ignored' AND trend_score >= ${cfg.thresholds.review} AND last_seen_at > now() - interval '24 hours'`,
      sql`SELECT COUNT(*)::int AS n FROM articles WHERE type = 'news' AND status = ANY(${OPEN_STATUSES}::text[])`,
      sql`SELECT id FROM articles WHERE type = 'news' AND status = ANY(${OPEN_STATUSES}::text[]) ORDER BY updated_at DESC LIMIT 60`,
      sql`SELECT COUNT(*)::int AS n FROM articles WHERE type = 'news' AND status = 'published' AND published_at > now() - interval '24 hours'`,
      listStories({ limit: 5 }).catch(() => ({ stories: [] as Story[] })),
    ]);
    // "Ready" uses the real publish gate, so the number matches what Publish
    // allows. Checked for the 60 most recently updated drafts.
    const checks = await Promise.all(drafts.map((d: any) => newsPublishProblems(String(d.id)).catch(() => ["error"])));
    return {
      trending: Number(trend[0]?.n ?? 0),
      drafts: Number(draftCount[0]?.n ?? 0),
      ready: checks.filter((p) => p.length === 0).length,
      publishedToday: Number(published[0]?.n ?? 0),
      top: stories.stories,
    };
  } catch {
    return EMPTY; // news tables not migrated yet
  }
}
