// Phase 12 — the audit record for one news article: which story and sources
// it came from, the researched facts, every AI call (model, prompt version,
// tokens, cost, time), the fact check, every revision (AI and human), the
// editors' decisions and the approval. Read-only; built from existing rows.
import { sql } from "../db";
import { getRevisions } from "../revisions";
import { getReviewsForArticle } from "../reviews";
import { getArticleSources } from "../articles";
import { getLatestResearch } from "./research";
import { getFactCheck } from "./factcheck";
import { listAiRuns, type AiRun } from "./aiRuns";
import { AI_EDITOR } from "./aiRevision";

export interface AuditEvent {
  at: string;
  who: string; // editor email, "AI" or "automation"
  what: string;
  detail?: string;
}

export interface ArticleAudit {
  article: { id: string; title: string; status: string; createdAt: string; publishedAt: string | null; scheduledAt: string | null };
  story: { id: string; title: string; firstSeenAt: string; sourceCount: number; trendScore: number | null } | null;
  sources: { n: number; publisher: string; url: string; isOfficial: boolean }[];
  research: { model: string; at: string; facts: number; sources: number } | null;
  generation: { model: string; promptVersion: string; writtenAt: string; wordCount: number } | null;
  check: { verdict: string; model: string; at: string; stale: boolean; overridden: boolean; overrideReason: string } | null;
  aiRuns: AiRun[];
  totals: { calls: number; failed: number; tokensIn: number; tokensOut: number; costUsd: number };
  timeline: AuditEvent[]; // oldest first
}

const iso = (v: unknown): string => (v instanceof Date ? v.toISOString() : v ? String(v) : "");

const DECISION_LABEL: Record<string, string> = {
  shortlisted: "Shortlisted the story",
  ignored: "Ignored the story",
  drafted: "Generated the draft",
  auto_drafted: "Automation drafted the story",
  published: "Published",
};

export function summarizeRuns(runs: AiRun[]): ArticleAudit["totals"] {
  return runs.reduce(
    (t, r) => ({
      calls: t.calls + 1,
      failed: t.failed + (r.outcome === "ok" ? 0 : 1),
      tokensIn: t.tokensIn + (r.tokensIn || 0),
      tokensOut: t.tokensOut + (r.tokensOut || 0),
      costUsd: Math.round((t.costUsd + (r.costUsd || 0)) * 10000) / 10000,
    }),
    { calls: 0, failed: 0, tokensIn: 0, tokensOut: 0, costUsd: 0 }
  );
}

export async function getArticleAudit(articleId: string): Promise<ArticleAudit> {
  const a = (await sql`
    SELECT id, title, status, submitted_at, updated_at, published_at, scheduled_at, news_cluster_id FROM articles WHERE id = ${articleId} LIMIT 1`)[0];
  if (!a) throw new Error("Article not found.");
  const clusterId: string | null = a.news_cluster_id ? String(a.news_cluster_id) : null;

  const [cluster, sources, research, check, runs, revisions, reviews, extra, decisions, activity] = await Promise.all([
    clusterId ? sql`SELECT id, canonical_title, first_seen_at, source_count, trend_score FROM story_clusters WHERE id = ${clusterId} LIMIT 1`.then((r) => r[0]).catch(() => null) : null,
    getArticleSources(articleId),
    clusterId ? getLatestResearch(clusterId).catch(() => null) : null,
    getFactCheck(articleId).catch(() => null),
    listAiRuns(articleId, clusterId),
    getRevisions(articleId).catch(() => []),
    getReviewsForArticle(articleId).catch(() => []),
    sql`SELECT generation FROM news_article_extra WHERE article_id = ${articleId} LIMIT 1`.then((r) => r[0]?.generation || null).catch(() => null),
    clusterId
      ? (sql`SELECT decision, score, rank, decided_by, decided_at FROM news_story_decisions WHERE cluster_id = ${clusterId} ORDER BY decided_at`.catch(() => []) as Promise<any[]>)
      : ([] as any[]),
    sql`SELECT admin_email, action, created_at FROM activity_log WHERE target_id = ${articleId} ORDER BY created_at`.catch(() => []) as Promise<any[]>,
  ]);

  const timeline: AuditEvent[] = [];
  if (cluster) timeline.push({ at: iso(cluster.first_seen_at), who: "automation", what: "Story discovered", detail: `${cluster.source_count} source(s)` });
  for (const d of decisions as any[]) {
    timeline.push({
      at: iso(d.decided_at),
      who: d.decided_by === "automation" ? "automation" : d.decided_by,
      what: DECISION_LABEL[d.decision] || d.decision,
      detail: d.score !== null && d.score !== undefined ? `trend score ${d.score}${d.rank ? `, rank ${d.rank}` : ""}` : undefined,
    });
  }
  for (const r of runs) {
    timeline.push({
      at: r.createdAt,
      who: "AI",
      what: `${r.kind} (${r.model})${r.outcome === "ok" ? "" : " failed"}`,
      detail: [r.promptVersion, r.tokensIn !== null ? `${r.tokensIn}+${r.tokensOut ?? 0} tokens` : "", r.costUsd ? `$${r.costUsd.toFixed(4)}` : "", `${(r.durationMs / 1000).toFixed(1)}s`, r.error]
        .filter(Boolean)
        .join(" · "),
    });
  }
  for (const v of revisions) {
    timeline.push({ at: v.createdAt, who: v.editorEmail === AI_EDITOR.email ? "AI" : v.editorEmail || "editor", what: "Revision saved", detail: v.changeSummary });
  }
  for (const rv of reviews) {
    timeline.push({ at: rv.createdAt, who: rv.adminEmail, what: `Review: ${rv.decision}`, detail: rv.feedback || undefined });
  }
  for (const act of activity) {
    timeline.push({ at: iso(act.created_at), who: act.admin_email || "admin", what: String(act.action).replace(/_/g, " ") });
  }
  if (check?.overridden) timeline.push({ at: check.checkedAt, who: "editor", what: "Fact check overridden", detail: check.overrideReason });
  timeline.sort((x, y) => Date.parse(x.at) - Date.parse(y.at));

  return {
    article: {
      id: String(a.id),
      title: String(a.title || ""),
      status: String(a.status),
      createdAt: iso(a.submitted_at || a.updated_at),
      publishedAt: a.published_at ? iso(a.published_at) : null,
      scheduledAt: a.scheduled_at ? iso(a.scheduled_at) : null,
    },
    story: cluster
      ? { id: String(cluster.id), title: String(cluster.canonical_title), firstSeenAt: iso(cluster.first_seen_at), sourceCount: Number(cluster.source_count || 0), trendScore: cluster.trend_score ?? null }
      : null,
    sources: sources.map((s) => ({ n: s.n, publisher: s.publisher || s.title, url: s.url, isOfficial: s.isOfficial })),
    research:
      research && research.status === "done"
        ? {
            model: research.model,
            at: research.finishedAt || research.createdAt,
            facts: research.facts?.important_facts.length || 0,
            sources: research.sources.length,
          }
        : null,
    generation: extra ? { model: extra.model || "", promptVersion: extra.promptVersion || "", writtenAt: extra.writtenAt || "", wordCount: Number(extra.wordCount || 0) } : null,
    check: check
      ? { verdict: check.verdict, model: check.model, at: check.checkedAt, stale: check.stale, overridden: check.overridden, overrideReason: check.overrideReason }
      : null,
    aiRuns: runs,
    totals: summarizeRuns(runs),
    timeline,
  };
}
