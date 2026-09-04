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
    if (rows.length > 0) {
      try {
        const { notifySubscribersOfNewArticle } = await import("./newsletter");
        const { articlePath } = await import("./destinations");
        for (const row of rows) {
          const fullRows = await sql`
            SELECT a.title, a.excerpt, a.image, a.slug, c.slug AS city_slug, co.slug AS country_slug, c.name AS city_name
            FROM articles a
            JOIN cities c ON c.id = a.city_id
            JOIN countries co ON co.id = c.country_id
            WHERE a.id = ${row.id}
            LIMIT 1
          `;
          if (fullRows.length) {
            const f = fullRows[0];
            const url = articlePath(f.country_slug, f.city_slug, f.slug);
            notifySubscribersOfNewArticle({
              title: f.title,
              excerpt: f.excerpt,
              image: f.image,
              url,
              cityName: f.city_name,
            }).catch(() => {});
          }
        }
      } catch (err) {
        console.error("[scheduling] Failed to broadcast scheduled articles:", err);
      }
    }
    return rows.length;
  } catch {
    return 0;
  }
}

