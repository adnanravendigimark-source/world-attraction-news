// Phase 10 — automation. A Postgres job table worked by Vercel Cron.
// Pipeline per story: research → draft → write → check → image. Each step is
// its own job and makes at most a few model calls, so no step can outrun the
// function time limit. Nothing is ever published here: drafts land in the
// normal review queue as Pending Review.
import { sql } from "../db";
import { loadFilterConfig } from "./filter";
import { runResearch } from "./research";
import { createDraftFromStory } from "./drafts";
import { recordDecision } from "./decisions";
import { costLast24h, overCap, researchUsable } from "./ops";
import { ensureImages } from "./imagegen";
import { enrichArticle } from "./seo";
import { writeArticle } from "./writer";
import { checkAndRevise } from "./factcheck";

export type JobKind = "research" | "draft" | "write" | "check" | "image";

export interface AutomationConfig {
  enabled: boolean;
  dailyTarget: number; // stories started per rolling 24h
  minScore: number; // minimum trend score
  maxAgeHours: number; // ignore stories not seen within this window
  draft: boolean; // create a draft after research
  image: boolean; // generate an AI cover after the draft
  inlinePhotos: boolean; // add a photo between paragraphs (150+ words)
  dailyCostCapUsd: number; // stop starting stories once AI spend in 24 h reaches this (0 = no cap)
  minFacts: number; // research must find this many facts (and read one source in full) to draft
  minQuality: number; // quality score an article needs before it can be published
}

export const DEFAULT_AUTOMATION: AutomationConfig = {
  enabled: false,
  dailyTarget: 8,
  minScore: 58,
  maxAgeHours: 48,
  draft: true,
  image: true,
  inlinePhotos: true,
  dailyCostCapUsd: 2,
  minFacts: 4,
  minQuality: 75,
};

export interface NewsJob {
  id: number;
  kind: JobKind;
  clusterId: string;
  articleId: string | null;
  status: string;
  attempts: number;
  maxAttempts: number;
  runAfter: string;
  error: string;
  createdAt: string;
  finishedAt: string | null;
  title: string;
}

export async function loadAutomation(): Promise<AutomationConfig> {
  try {
    const rows = await sql`SELECT value FROM news_settings WHERE key = 'automation' LIMIT 1`;
    return { ...DEFAULT_AUTOMATION, ...(rows[0]?.value || {}) };
  } catch {
    return DEFAULT_AUTOMATION;
  }
}

export async function saveAutomation(patch: Partial<AutomationConfig>): Promise<AutomationConfig> {
  const cur = await loadAutomation();
  const next: AutomationConfig = {
    enabled: typeof patch.enabled === "boolean" ? patch.enabled : cur.enabled,
    dailyTarget: clampInt(patch.dailyTarget, 1, 30, cur.dailyTarget),
    minScore: clampInt(patch.minScore, 0, 100, cur.minScore),
    maxAgeHours: clampInt(patch.maxAgeHours, 6, 168, cur.maxAgeHours),
    draft: typeof patch.draft === "boolean" ? patch.draft : cur.draft,
    image: typeof patch.image === "boolean" ? patch.image : cur.image,
    inlinePhotos: typeof patch.inlinePhotos === "boolean" ? patch.inlinePhotos : cur.inlinePhotos,
    dailyCostCapUsd: Number.isFinite(Number(patch.dailyCostCapUsd)) ? Math.min(100, Math.max(0, Math.round(Number(patch.dailyCostCapUsd) * 100) / 100)) : cur.dailyCostCapUsd,
    minFacts: clampInt(patch.minFacts, 1, 20, cur.minFacts),
    minQuality: clampInt(patch.minQuality, 0, 100, cur.minQuality),
  };
  await sql`
    INSERT INTO news_settings (key, value, updated_at) VALUES ('automation', ${JSON.stringify(next)}::jsonb, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
  `;
  return next;
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export async function enqueueJob(kind: JobKind, clusterId: string, articleId?: string | null): Promise<boolean> {
  const rows = await sql`
    INSERT INTO news_jobs (kind, cluster_id, article_id) VALUES (${kind}, ${clusterId}, ${articleId ?? null})
    ON CONFLICT DO NOTHING RETURNING id`;
  return rows.length > 0;
}

// Picks the best un-started stories, up to what's left of today's target.
export async function enqueueEligible(cfg?: AutomationConfig): Promise<{ queued: number; remaining: number }> {
  const c = cfg ?? (await loadAutomation());
  // Phase 13: no new stories once the day's AI spend reaches the cap.
  if (overCap(await costLast24h(), c.dailyCostCapUsd)) return { queued: 0, remaining: 0 };
  const used = await sql`SELECT COUNT(*)::int AS n FROM news_jobs WHERE kind = 'research' AND status <> 'cancelled' AND created_at > now() - interval '24 hours'`;
  const remaining = Math.max(0, c.dailyTarget - Number(used[0]?.n ?? 0));
  if (remaining === 0) return { queued: 0, remaining: 0 };
  const minRel = (await loadFilterConfig()).relevantMin;
  const rows = await sql`
    SELECT sc.id FROM story_clusters sc
    WHERE sc.status NOT IN ('ignored', 'merged')
      AND sc.trend_score >= ${c.minScore}
      AND EXISTS (SELECT 1 FROM news_items i WHERE i.cluster_id = sc.id AND i.relevance_score >= ${minRel})
      AND sc.last_seen_at > now() - (${c.maxAgeHours} * interval '1 hour')
      AND NOT EXISTS (SELECT 1 FROM articles a WHERE a.news_cluster_id = sc.id)
      AND NOT EXISTS (SELECT 1 FROM news_jobs j WHERE j.cluster_id = sc.id AND j.kind = 'research'
                      AND (j.status IN ('queued', 'running', 'done', 'cancelled')
                           OR (j.status = 'failed' AND j.finished_at > now() - interval '24 hours')))
    ORDER BY sc.trend_score DESC NULLS LAST
    LIMIT ${remaining}`;
  let queued = 0;
  for (const r of rows) if (await enqueueJob("research", r.id as string)) queued++;
  return { queued, remaining: remaining - queued };
}

// How many un-started stories qualify right now (for the Automation page).
export async function countEligible(cfg?: AutomationConfig): Promise<number> {
  const c = cfg ?? (await loadAutomation());
  const minRel = (await loadFilterConfig()).relevantMin;
  const r = await sql`
    SELECT COUNT(*)::int AS n FROM story_clusters sc
    WHERE sc.status NOT IN ('ignored', 'merged')
      AND sc.trend_score >= ${c.minScore}
      AND EXISTS (SELECT 1 FROM news_items i WHERE i.cluster_id = sc.id AND i.relevance_score >= ${minRel})
      AND sc.last_seen_at > now() - (${c.maxAgeHours} * interval '1 hour')
      AND NOT EXISTS (SELECT 1 FROM articles a WHERE a.news_cluster_id = sc.id)
      AND NOT EXISTS (SELECT 1 FROM news_jobs j WHERE j.cluster_id = sc.id AND j.kind = 'research' AND j.status IN ('queued', 'running', 'done', 'cancelled'))`;
  return Number(r[0]?.n ?? 0);
}

// A running job's worker refreshes heartbeat_at every 20 seconds. A job with
// no heartbeat for this long has lost its worker (the function was stopped)
// and is freed for a retry. Function runs are capped at 300 s, so a live job
// never goes this long without a heartbeat.
const STALE_MINUTES = 6;

async function releaseDeadJobs(): Promise<void> {
  try {
    await sql`UPDATE news_jobs SET status = CASE WHEN attempts >= max_attempts THEN 'failed' ELSE 'queued' END,
                error = CASE WHEN attempts >= max_attempts THEN 'Stopped before finishing (timed out).' ELSE 'Retrying after the previous run stopped.' END,
                finished_at = CASE WHEN attempts >= max_attempts THEN now() ELSE NULL END, locked_at = NULL
              WHERE status = 'running' AND GREATEST(heartbeat_at, locked_at) < now() - (${STALE_MINUTES} * interval '1 minute')`;
  } catch {
    // heartbeat_at not migrated yet (run scripts/setup-db.mjs): fall back to the lock time.
    await sql`UPDATE news_jobs SET status = CASE WHEN attempts >= max_attempts THEN 'failed' ELSE 'queued' END,
                error = CASE WHEN attempts >= max_attempts THEN 'Stopped before finishing (timed out).' ELSE error END,
                finished_at = CASE WHEN attempts >= max_attempts THEN now() ELSE NULL END, locked_at = NULL
              WHERE status = 'running' AND locked_at < now() - interval '10 minutes'`;
  }
}

function startHeartbeat(id: number): () => void {
  const beat = () => {
    sql`UPDATE news_jobs SET heartbeat_at = now() WHERE id = ${id} AND status = 'running'`.catch(() => {});
  };
  beat();
  const timer = setInterval(beat, 20_000);
  return () => clearInterval(timer);
}

// True while automation is working on this story's write/check steps, so a
// manual "Create news draft" doesn't write the same article at the same time.
export async function storyBusy(clusterId: string): Promise<boolean> {
  const rows = await sql`SELECT 1 FROM news_jobs WHERE cluster_id = ${clusterId} AND kind IN ('draft', 'write', 'check') AND status = 'running' LIMIT 1`.catch(() => []);
  return rows.length > 0;
}

async function claimNext(): Promise<any | null> {
  await releaseDeadJobs();
  const rows = await sql`
    UPDATE news_jobs SET status = 'running', locked_at = now(), attempts = attempts + 1
    WHERE id = (SELECT id FROM news_jobs WHERE status = 'queued' AND run_after <= now()
                ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1)
    RETURNING *`;
  return rows[0] ?? null;
}

async function execute(job: any, cfg: AutomationConfig): Promise<{ result: any; articleId?: string | null }> {
  const clusterId = job.cluster_id as string;
  if (job.kind === "research") {
    const rec = await runResearch(clusterId, "automation");
    if (rec.status !== "done") throw new Error(rec.error || "Research did not complete.");
    // Phase 13: don't spend on writing a story the research can't support.
    const usable = researchUsable(
      { facts: (rec.facts?.important_facts.length ?? 0) + (rec.facts?.confirmed_numbers.length ?? 0), sourcesRead: rec.sources.filter((s) => s.usedText).length },
      cfg.minFacts
    );
    if (!usable.ok) return { result: { facts: true, skipped: `Not drafted: ${usable.reason}` } };
    if (cfg.draft) await enqueueJob("draft", clusterId);
    return { result: { facts: true } };
  }
  if (job.kind === "draft") {
    const { article, created } = await createDraftFromStory(clusterId);
    if (created) await recordDecision(clusterId, "auto_drafted", "automation");
    await enqueueJob("write", clusterId, article.id);
    return { result: { created }, articleId: article.id };
  }
  if (job.kind === "write") {
    if (!job.article_id) throw new Error("No article for this write job.");
    const { wordCount } = await writeArticle(job.article_id as string);
    await enrichArticle(job.article_id as string);
    await enqueueJob("check", clusterId, job.article_id as string);
    return { result: { wordCount }, articleId: job.article_id };
  }
  if (job.kind === "check") {
    if (!job.article_id) throw new Error("No article for this check job.");
    const { check, revised } = await checkAndRevise(job.article_id as string);
    // A revision rewrites the text; re-apply internal links to it.
    if (revised) await enrichArticle(job.article_id as string);
    if (cfg.image) await enqueueJob("image", clusterId, job.article_id as string);
    return { result: { verdict: check.verdict, issues: check.issues.length, revised }, articleId: job.article_id };
  }
  if (job.kind === "image") {
    if (!job.article_id) throw new Error("No article for this image job.");
    const r = await ensureImages(job.article_id as string);
    return { result: { cover: r.cover, inline: r.inline }, articleId: job.article_id };
  }
  throw new Error(`Unknown job kind: ${job.kind}`);
}

// The worst single job (check + one revision + re-check) takes up to about
// 3.75 minutes of model time (three calls of up to 75 s). Routes that call runJobs set maxDuration = 300,
// so a new job is only started while that much time is still left.
const JOB_RESERVE_MS = 230_000;

export async function runJobs(opts: { budgetMs?: number } = {}): Promise<{ processed: number; done: number; failed: number; retried: number }> {
  const started = Date.now();
  const budget = opts.budgetMs ?? 290_000;
  const cfg = await loadAutomation();
  const out = { processed: 0, done: 0, failed: 0, retried: 0 };
  while (true) {
    if (out.processed > 0 && budget - (Date.now() - started) < JOB_RESERVE_MS) break;
    // Phase 13: over the daily AI cost cap, leave the queue for later.
    if (overCap(await costLast24h(), cfg.dailyCostCapUsd)) break;
    const job = await claimNext();
    if (!job) break;
    out.processed++;
    const stopBeat = startHeartbeat(Number(job.id));
    try {
      const { result, articleId } = await execute(job, cfg);
      await sql`UPDATE news_jobs SET status = 'done', result = ${JSON.stringify(result)}::jsonb, article_id = COALESCE(${articleId ?? null}, article_id),
                  error = '', finished_at = now(), locked_at = NULL WHERE id = ${job.id}`;
      out.done++;
    } catch (err: any) {
      const message = String(err?.message || err).slice(0, 400);
      const final = job.attempts >= job.max_attempts;
      // Back off 10, 20, 40 minutes (billing or rate-limit problems often clear).
      const minutes = 10 * 2 ** Math.max(0, job.attempts - 1);
      if (final) {
        await sql`UPDATE news_jobs SET status = 'failed', error = ${message}, finished_at = now(), locked_at = NULL WHERE id = ${job.id}`;
        out.failed++;
      } else {
        await sql`UPDATE news_jobs SET status = 'queued', error = ${message}, locked_at = NULL,
                    run_after = now() + (${minutes} * interval '1 minute') WHERE id = ${job.id}`;
        out.retried++;
      }
    } finally {
      stopBeat();
    }
  }
  return out;
}

export async function listJobs(limit = 60): Promise<NewsJob[]> {
  const rows = await sql`
    SELECT j.*, COALESCE(sc.canonical_title, '') AS title FROM news_jobs j
    LEFT JOIN story_clusters sc ON sc.id = j.cluster_id
    ORDER BY j.id DESC LIMIT ${limit}`;
  return rows.map((r: any) => ({
    id: Number(r.id),
    kind: r.kind,
    clusterId: r.cluster_id,
    articleId: r.article_id,
    status: r.status,
    attempts: r.attempts,
    maxAttempts: r.max_attempts,
    runAfter: new Date(r.run_after).toISOString(),
    error: r.error,
    createdAt: new Date(r.created_at).toISOString(),
    finishedAt: r.finished_at ? new Date(r.finished_at).toISOString() : null,
    title: r.title,
  }));
}

export async function jobStats(): Promise<Record<string, number>> {
  const rows = await sql`SELECT status, COUNT(*)::int AS n FROM news_jobs WHERE created_at > now() - interval '7 days' GROUP BY status`;
  return Object.fromEntries(rows.map((r: any) => [r.status, Number(r.n)]));
}

export async function retryJob(id: number): Promise<void> {
  // A failed step may have been retired from the unique index; requeue in place.
  await sql`UPDATE news_jobs SET status = 'queued', attempts = 0, error = '', run_after = now(), finished_at = NULL, locked_at = NULL
            WHERE id = ${id} AND status = 'failed'`;
}

export async function cancelJob(id: number): Promise<void> {
  await sql`UPDATE news_jobs SET status = 'cancelled', finished_at = now(), locked_at = NULL WHERE id = ${id} AND status IN ('queued', 'failed')`;
}
