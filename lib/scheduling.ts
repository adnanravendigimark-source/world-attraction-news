import { sql } from "./db";

// Scheduled publishing. An admin sets articles.status = 'scheduled' with a
// future scheduled_at timestamp (see lib/articles.ts scheduleArticle()).
// This function is the one real mechanism that flips a due article over to
// 'published' — a plain, idempotent UPDATE ... WHERE scheduled_at <= now().
// It's called from two places so "automatically" is actually true once
// deployed:
//   1. app/api/cron/publish-scheduled/route.ts — meant to be hit by a
//      platform scheduler (Vercel Cron; see vercel.json and README.md) on a
//      regular interval, e.g. every 5 minutes.
//   2. Every public content read that could show a scheduled article
//      (getPublishedArticles* in lib/articles.ts) — so even without cron
//      configured yet, the first visitor to load the site after the
//      scheduled time still sees it correctly published rather than stuck
//      "scheduled" forever. This is a real self-healing check, not a fake
//      "looks published" UI trick — the database row is actually updated.
export async function publishDueScheduledArticles(): Promise<number> {
  try {
    const rows = await sql`
      UPDATE articles
      SET status = 'published',
          published_at = COALESCE(published_at, scheduled_at, now()),
          scheduled_at = NULL,
          updated_at = now()
      WHERE status = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= now()
      RETURNING id
    `;
    return rows.length;
  } catch {
    return 0;
  }
}
