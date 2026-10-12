// Phases 13–14 — cost control, health and alerts for the news pipeline.
// Pure helpers first (tested), then the database readers and the emails.
import { sql } from "../db";

// ---------------------------------------------------------------- cost (13)

export async function costLast24h(): Promise<number> {
  try {
    const r = await sql`SELECT COALESCE(SUM(cost_usd), 0)::float AS usd FROM ai_runs WHERE created_at > now() - interval '24 hours'`;
    return Number(r[0]?.usd ?? 0);
  } catch {
    return 0; // ai_runs not migrated: no cost known
  }
}

export function overCap(spentUsd: number, capUsd: number): boolean {
  return capUsd > 0 && spentUsd >= capUsd;
}

// A story is worth drafting only when research found enough facts and at
// least one source was read in full (not just headlines).
export function researchUsable(r: { facts: number; sourcesRead: number }, minFacts: number): { ok: boolean; reason: string } {
  if (r.facts < minFacts) return { ok: false, reason: `only ${r.facts} fact(s), ${minFacts} needed` };
  if (r.sourcesRead === 0) return { ok: false, reason: "no source could be read in full (headlines only)" };
  return { ok: true, reason: "" };
}

// ---------------------------------------------------------------- health (14)

export interface HealthInput {
  now: number;
  lastOkFetchAt: string | null;
  failingSources: { name: string; error: string; failures: number }[];
  stuckJobs: number; // running with no heartbeat for 6+ minutes, or queued 2+ hours past due
  jobFailStreaks: Record<string, number>; // kind -> consecutive final failures (newest first)
  failedJobs24h: number;
  ai24h: { calls: number; errors: number; rateLimited: number };
  readyMissingImage: number;
  researchIncomplete24h: number; // research runs that failed or came out thin
  publishFailures24h: number;
  costUsd: number;
  capUsd: number;
}

export type HealthLevel = "ok" | "warn" | "error";
export interface HealthCheck {
  key: string;
  label: string;
  level: HealthLevel;
  note: string;
}

export const FETCH_STALE_HOURS = 2;
export const FAIL_STREAK_ALERT = 3;

export function healthChecks(h: HealthInput): HealthCheck[] {
  const hoursSinceFetch = h.lastOkFetchAt ? (h.now - Date.parse(h.lastOkFetchAt)) / 3_600_000 : Infinity;
  const errRate = h.ai24h.calls ? h.ai24h.errors / h.ai24h.calls : 0;
  const streaks = Object.entries(h.jobFailStreaks).filter(([, n]) => n >= FAIL_STREAK_ALERT);
  const c = (key: string, label: string, level: HealthLevel, note: string): HealthCheck => ({ key, label, level, note });
  return [
    c("fetch", "Feeds fetched", hoursSinceFetch > FETCH_STALE_HOURS ? "error" : "ok",
      Number.isFinite(hoursSinceFetch) ? `last successful fetch ${hoursSinceFetch < 1 ? "<1" : Math.round(hoursSinceFetch)} h ago` : "no successful fetch yet"),
    c("sources", "Sources", h.failingSources.length ? "warn" : "ok",
      h.failingSources.length ? `${h.failingSources.length} failing: ${h.failingSources.slice(0, 3).map((s) => `${s.name} (${s.error})`).join(", ")}` : "all active sources healthy"),
    c("jobs", "Automation jobs", streaks.length ? "error" : h.stuckJobs || h.failedJobs24h ? "warn" : "ok",
      [streaks.length ? `${streaks.map(([k, n]) => `${k} failed ${n}× in a row`).join(", ")}` : "", h.stuckJobs ? `${h.stuckJobs} stuck` : "", h.failedJobs24h ? `${h.failedJobs24h} failed in 24 h` : ""]
        .filter(Boolean).join("; ") || "no failures"),
    c("ai", "AI calls", errRate > 0.25 && h.ai24h.errors >= 3 ? "error" : h.ai24h.errors ? "warn" : "ok",
      h.ai24h.calls ? `${h.ai24h.errors} of ${h.ai24h.calls} failed in 24 h${h.ai24h.rateLimited ? `, ${h.ai24h.rateLimited} rate-limited` : ""}` : "no calls in 24 h"),
    c("research", "Research", h.researchIncomplete24h ? "warn" : "ok", h.researchIncomplete24h ? `${h.researchIncomplete24h} incomplete in 24 h` : "complete"),
    c("images", "Images", h.readyMissingImage ? "warn" : "ok", h.readyMissingImage ? `${h.readyMissingImage} draft(s) without a cover` : "every draft has a cover"),
    c("publish", "Publishing", h.publishFailures24h ? "error" : "ok", h.publishFailures24h ? `${h.publishFailures24h} scheduled publish(es) failed` : "no failures"),
    c("cost", "AI cost (24 h)", overCap(h.costUsd, h.capUsd) ? "warn" : "ok",
      `$${h.costUsd.toFixed(2)}${h.capUsd > 0 ? ` of $${h.capUsd.toFixed(2)} cap${overCap(h.costUsd, h.capUsd) ? ": new stories paused" : ""}` : ", no cap"}`),
  ];
}

// Consecutive final failures per job kind, from rows ordered newest first.
export function failStreaks(rows: { kind: string; status: string }[]): Record<string, number> {
  const out: Record<string, number> = {};
  const closed = new Set<string>();
  for (const r of rows) {
    if (closed.has(r.kind)) continue;
    if (r.status === "failed") out[r.kind] = (out[r.kind] || 0) + 1;
    else if (r.status === "done") closed.add(r.kind);
  }
  return out;
}

const q = async <T>(p: Promise<T>, fallback: T): Promise<T> => p.catch(() => fallback);

export async function loadHealth(capUsd: number): Promise<HealthCheck[]> {
  const [fetchRow, failing, stuck, jobRows, failed24, ai, readyNoImg, research, publish, cost] = await Promise.all([
    q(sql`SELECT MAX(finished_at) AS at FROM news_fetch_runs WHERE sources_checked > 0 AND errors < sources_checked`, [] as any[]),
    q(sql`SELECT name, last_error, consecutive_failures FROM news_sources WHERE is_active AND last_status = 'error' ORDER BY consecutive_failures DESC`, [] as any[]),
    q(sql`SELECT COUNT(*)::int AS n FROM news_jobs WHERE (status = 'running' AND GREATEST(heartbeat_at, locked_at) < now() - interval '6 minutes')
              OR (status = 'queued' AND run_after < now() - interval '2 hours')`, [] as any[]),
    q(sql`SELECT kind, status FROM news_jobs WHERE status IN ('done', 'failed') ORDER BY finished_at DESC NULLS LAST LIMIT 200`, [] as any[]),
    q(sql`SELECT COUNT(*)::int AS n FROM news_jobs WHERE status = 'failed' AND finished_at > now() - interval '24 hours'`, [] as any[]),
    q(sql`SELECT COUNT(*)::int AS calls, COUNT(*) FILTER (WHERE outcome <> 'ok')::int AS errors,
              COUNT(*) FILTER (WHERE error ILIKE '%429%' OR error ILIKE '%rate limit%')::int AS rl
          FROM ai_runs WHERE created_at > now() - interval '24 hours'`, [] as any[]),
    q(sql`SELECT COUNT(*)::int AS n FROM articles WHERE type = 'news' AND status IN ('pending', 'under_review', 'approved') AND COALESCE(image, '') = ''`, [] as any[]),
    q(sql`SELECT COUNT(*)::int AS n FROM story_research WHERE created_at > now() - interval '24 hours'
              AND (status = 'failed' OR COALESCE(jsonb_array_length(facts->'important_facts'), 0) < 3)`, [] as any[]),
    q(sql`SELECT COUNT(*)::int AS n FROM activity_log WHERE action = 'scheduled_publish_failed' AND created_at > now() - interval '24 hours'`, [] as any[]),
    costLast24h(),
  ]);
  return healthChecks({
    now: Date.now(),
    lastOkFetchAt: fetchRow[0]?.at ? new Date(fetchRow[0].at).toISOString() : null,
    failingSources: failing.map((s: any) => ({ name: s.name, error: String(s.last_error || "").slice(0, 60), failures: Number(s.consecutive_failures || 0) })),
    stuckJobs: Number(stuck[0]?.n ?? 0),
    jobFailStreaks: failStreaks(jobRows as any[]),
    failedJobs24h: Number(failed24[0]?.n ?? 0),
    ai24h: { calls: Number(ai[0]?.calls ?? 0), errors: Number(ai[0]?.errors ?? 0), rateLimited: Number(ai[0]?.rl ?? 0) },
    readyMissingImage: Number(readyNoImg[0]?.n ?? 0),
    researchIncomplete24h: Number(research[0]?.n ?? 0),
    publishFailures24h: Number(publish[0]?.n ?? 0),
    costUsd: cost,
    capUsd,
  });
}

// ---------------------------------------------------------------- email

async function adminEmails(): Promise<string[]> {
  const rows = await q(sql`SELECT email FROM users WHERE role = 'admin' AND COALESCE(status, 'approved') <> 'suspended' AND email NOT LIKE '%.system'`, [] as any[]);
  return rows.map((r: any) => String(r.email)).filter(Boolean);
}

// Sends at most once per `everyHours` per key (remembered in news_settings).
async function throttled(key: string, everyHours: number): Promise<boolean> {
  try {
    const rows = await sql`SELECT value FROM news_settings WHERE key = 'alerts' LIMIT 1`;
    const sent: Record<string, string> = rows[0]?.value || {};
    if (sent[key] && Date.now() - Date.parse(sent[key]) < everyHours * 3_600_000) return false;
    sent[key] = new Date().toISOString();
    await sql`INSERT INTO news_settings (key, value, updated_at) VALUES ('alerts', ${JSON.stringify(sent)}::jsonb, now())
              ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
    return true;
  } catch {
    return false;
  }
}

async function mailAdmins(title: string, body: string, link: string): Promise<number> {
  const { sendNotificationEmail } = await import("../email");
  let sent = 0;
  for (const to of await adminEmails()) {
    try {
      await sendNotificationEmail(to, title, body, link);
      sent++;
    } catch {
      /* Resend not configured or delivery failed */
    }
  }
  return sent;
}

// Phase 14: alert when feeds stop or a job type keeps failing (6-hourly at most).
export async function sendAlerts(capUsd: number): Promise<string[]> {
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/+$/, "");
  const checks = await loadHealth(capUsd);
  const out: string[] = [];
  for (const c of checks.filter((x) => x.level === "error" && ["fetch", "jobs", "ai", "publish"].includes(x.key))) {
    if (!(await throttled(`alert:${c.key}`, 6))) continue;
    await mailAdmins(`News pipeline: ${c.label} needs attention`, `${c.label}: ${c.note}.`, `${site}/admin/news`);
    out.push(c.key);
  }
  return out;
}

// Phase 13: once a day, the Ready drafts waiting for approval.
export async function sendDailySummary(capUsd: number): Promise<boolean> {
  if (!(await throttled("summary", 20))) return false;
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/+$/, "");
  const drafts = (await q(
    sql`SELECT id, title, status FROM articles WHERE type = 'news' AND status IN ('pending', 'under_review', 'approved')
        AND updated_at > now() - interval '7 days' ORDER BY updated_at DESC LIMIT 20`,
    [] as any[]
  )) as any[];
  const { newsPublishProblems } = await import("../articles");
  const ready: string[] = [];
  const waiting: string[] = [];
  for (const d of drafts) {
    const problems = await newsPublishProblems(String(d.id)).catch(() => ["?"]);
    (problems.length ? waiting : ready).push(`• ${d.title}`);
  }
  const checks = await loadHealth(capUsd);
  const issues = checks.filter((c) => c.level !== "ok").map((c) => `• ${c.label}: ${c.note}`);
  const body = [
    `Ready to publish (${ready.length}):`, ...(ready.length ? ready : ["• none"]), "",
    `Drafts still needing work (${waiting.length}):`, ...(waiting.length ? waiting.slice(0, 10) : ["• none"]), "",
    `AI cost in the last 24 h: ${checks.find((c) => c.key === "cost")?.note || "unknown"}.`,
    ...(issues.length ? ["", "Needs attention:", ...issues] : []),
  ].join("\n");
  return (await mailAdmins(`Travel news: ${ready.length} ready to publish`, body, `${site}/admin/articles`)) > 0;
}
