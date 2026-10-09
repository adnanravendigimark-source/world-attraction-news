// Phase 6 — what editors pick versus what the trend score ranks first.
// Every shortlist, ignore, draft and publish is logged with the story's trend
// score and its rank among recent stories at that moment, so the score can
// be checked against real choices and the thresholds tuned from them.
import { sql } from "../db";

export type Decision = "shortlisted" | "ignored" | "drafted" | "auto_drafted" | "published";

// Stories competing for attention at the moment of a decision.
export const RANK_WINDOW_HOURS = 48;
// A pick counts as "seen by the score" when it ranked this high or better.
export const TOP_N = 15;
// Below this many editor picks the suggestion isn't worth much.
export const MIN_PICKS_FOR_SUGGESTION = 10;

export async function recordDecision(clusterId: string | null | undefined, decision: Decision, by: string): Promise<void> {
  if (!clusterId) return;
  try {
    await sql`
      INSERT INTO news_story_decisions (cluster_id, decision, score, rank, decided_by)
      SELECT c.id, ${decision}, c.trend_score,
             CASE WHEN c.trend_score IS NULL THEN NULL ELSE 1 + (
               SELECT COUNT(*) FROM story_clusters o
               WHERE o.status NOT IN ('merged', 'ignored') AND o.id <> c.id
                 AND o.last_seen_at > now() - (${RANK_WINDOW_HOURS}::int * interval '1 hour')
                 AND o.trend_score > c.trend_score
             )::int END,
             ${by}
      FROM story_clusters c WHERE c.id = ${clusterId}
    `;
  } catch (err) {
    // Logging must never block the editor's action (the table arrives with
    // scripts/setup-db.mjs).
    console.error("[news] recording a decision failed:", err);
  }
}

export async function recordDecisionForArticle(articleId: string, decision: Decision, by: string): Promise<void> {
  try {
    const row = (await sql`SELECT news_cluster_id FROM articles WHERE id = ${articleId} AND type = 'news' LIMIT 1`)[0];
    if (row?.news_cluster_id) await recordDecision(String(row.news_cluster_id), decision, by);
  } catch {
    /* not a news article, or nothing to log */
  }
}

export interface DecisionRow {
  clusterId: string;
  decision: Decision;
  score: number | null;
  rank: number | null;
  decidedAt: string;
}

export interface Calibration {
  days: number;
  picks: number; // stories an editor shortlisted, drafted or published
  ignored: number;
  autoDrafted: number;
  picksInTop: number; // picks that ranked TOP_N or better when picked
  topShare: number | null; // picksInTop / picks (0–1)
  pickScore: { p20: number; median: number } | null;
  ignoredMedian: number | null;
  suggested: { high: number; review: number } | null;
  note: string;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))));
  return sorted[i];
}

// Pure summary of logged decisions. A story counts once: as a pick if an
// editor ever shortlisted, drafted or published it (scored at its first
// pick), otherwise as ignored if it was ignored.
export function summarizeDecisions(rows: DecisionRow[], days: number): Calibration {
  const byCluster = new Map<string, DecisionRow[]>();
  for (const r of [...rows].sort((a, b) => Date.parse(a.decidedAt) - Date.parse(b.decidedAt))) {
    byCluster.set(r.clusterId, [...(byCluster.get(r.clusterId) || []), r]);
  }
  const picks: DecisionRow[] = [];
  const ignored: DecisionRow[] = [];
  let autoDrafted = 0;
  for (const list of byCluster.values()) {
    const pick = list.find((r) => r.decision === "shortlisted" || r.decision === "drafted" || r.decision === "published");
    if (pick) picks.push(pick);
    else if (list.some((r) => r.decision === "ignored")) ignored.push(list.find((r) => r.decision === "ignored")!);
    if (list.some((r) => r.decision === "auto_drafted")) autoDrafted++;
  }
  const ranked = picks.filter((p) => p.rank !== null);
  const picksInTop = ranked.filter((p) => (p.rank as number) <= TOP_N).length;
  const scores = picks.map((p) => p.score).filter((s): s is number => s !== null).sort((a, b) => a - b);
  const ignoredScores = ignored.map((p) => p.score).filter((s): s is number => s !== null).sort((a, b) => a - b);

  let suggested: Calibration["suggested"] = null;
  let note: string;
  if (scores.length < MIN_PICKS_FOR_SUGGESTION) {
    note = `${scores.length} of ${MIN_PICKS_FOR_SUGGESTION} editor picks needed before thresholds can be suggested. Shortlist, generate or publish the stories you would run.`;
  } else {
    // Half of the picks reach "high priority"; four in five reach "review".
    const high = percentile(scores, 0.5);
    const review = Math.min(high - 1, percentile(scores, 0.2));
    suggested = { high: Math.max(1, high), review: Math.max(0, review) };
    note = "Suggested from your picks: half of them reach the high-priority threshold, four in five reach review.";
  }
  return {
    days,
    picks: picks.length,
    ignored: ignored.length,
    autoDrafted,
    picksInTop,
    topShare: ranked.length ? picksInTop / ranked.length : null,
    pickScore: scores.length ? { p20: percentile(scores, 0.2), median: percentile(scores, 0.5) } : null,
    ignoredMedian: ignoredScores.length ? percentile(ignoredScores, 0.5) : null,
    suggested,
    note,
  };
}

export async function calibrationReport(days = 14): Promise<Calibration> {
  const rows = (await sql`
    SELECT cluster_id, decision, score, rank, decided_at FROM news_story_decisions
    WHERE decided_at > now() - (${days}::int * interval '1 day')
  `.catch(() => [])) as any[];
  return summarizeDecisions(
    rows.map((r) => ({
      clusterId: String(r.cluster_id),
      decision: r.decision,
      score: r.score === null ? null : Number(r.score),
      rank: r.rank === null ? null : Number(r.rank),
      decidedAt: r.decided_at instanceof Date ? r.decided_at.toISOString() : String(r.decided_at),
    })),
    days
  );
}
