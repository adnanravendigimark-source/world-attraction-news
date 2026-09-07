// One-off maintenance script: keeps only the newest N published articles and
// permanently deletes every other article (any status — draft, pending,
// rejected, changes_requested, approved, unpublished, scheduled, and any
// published article older than the newest N). Cities, categories, and
// attractions are NEVER touched by this script — only rows in `articles`.
//
// Safe by design:
//   - Defaults to a DRY RUN. It only prints what it *would* keep/delete.
//   - Add --confirm to actually run the DELETE. There is no undo — this is
//     a real, permanent deletion, not a status change.
//   - --keep=N overrides how many newest published articles to keep
//     (default 6).
//
// Cascades handled automatically by the DB schema (all ON DELETE CASCADE —
// see scripts/setup-db.mjs): article_revisions, article_reviews,
// article_views. No other table has a foreign key into articles — a few
// (activity_log.target_id, notifications.link) may still mention a deleted
// article's id/URL as plain text after this runs, which is expected and
// harmless (an activity log is a historical record, not a live reference).
//
// How to run it (from the project root, wherever DATABASE_URL is reachable —
// this sandbox's network is allowlisted and can't reach Neon, so this has
// to be run from your own machine or CI, not from here):
//   node scripts/trim-to-newest-articles.mjs             # dry run
//   node scripts/trim-to-newest-articles.mjs --confirm   # actually delete
//   node scripts/trim-to-newest-articles.mjs --keep=5 --confirm
//
// After a real run, give the site a minute or two (or redeploy) — the
// public pages that list articles (homepage, destinations, city pages,
// sitemap) are ISR-cached with short revalidate windows (60-300s), not
// force-dynamic, so they pick up the change on their own without needing
// revalidatePath() calls from here.

import fs from "fs";
import path from "path";
import { neon } from "@neondatabase/serverless";

function loadDotEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadDotEnv();

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Add it to your .env file, then re-run.");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

const args = process.argv.slice(2);
const confirmed = args.includes("--confirm");
const keepArg = args.find((a) => a.startsWith("--keep="));
const keepCount = keepArg ? parseInt(keepArg.split("=")[1], 10) : 6;

if (!Number.isFinite(keepCount) || keepCount < 1) {
  console.error(`Invalid --keep value. Must be a positive integer, got: ${keepArg}`);
  process.exit(1);
}

function formatRow(a) {
  const status = a.status.toUpperCase().padEnd(11);
  const date = a.published_at ? new Date(a.published_at).toISOString().slice(0, 10) : "—".padEnd(10);
  return `  [${status}] ${date}  ${a.title}  (/${a.city_slug || "?"}/${a.slug})`;
}

async function main() {
  const keepRows = await sql`
    SELECT a.id, a.slug, a.title, a.status, a.published_at, c.slug AS city_slug
    FROM articles a
    LEFT JOIN cities c ON c.id = a.city_id
    WHERE a.status = 'published'
    ORDER BY a.published_at DESC NULLS LAST
    LIMIT ${keepCount}
  `;
  const keepIds = keepRows.map((r) => r.id);

  const deleteRows = keepIds.length
    ? await sql`
        SELECT a.id, a.slug, a.title, a.status, a.published_at, c.slug AS city_slug
        FROM articles a
        LEFT JOIN cities c ON c.id = a.city_id
        WHERE a.id NOT IN (${sql.unsafe(keepIds.map((id) => `'${id}'`).join(","))})
        ORDER BY a.published_at DESC NULLS LAST
      `
    : await sql`
        SELECT a.id, a.slug, a.title, a.status, a.published_at, c.slug AS city_slug
        FROM articles a
        LEFT JOIN cities c ON c.id = a.city_id
        ORDER BY a.published_at DESC NULLS LAST
      `;

  console.log(`\nKeeping ${keepRows.length} article(s) (newest published, up to ${keepCount}):`);
  if (keepRows.length === 0) console.log("  (none — there are no published articles at all)");
  keepRows.forEach((a) => console.log(formatRow(a)));

  console.log(`\n${confirmed ? "Deleting" : "Would delete"} ${deleteRows.length} article(s):`);
  if (deleteRows.length === 0) console.log("  (none — nothing to delete)");
  deleteRows.forEach((a) => console.log(formatRow(a)));

  if (!confirmed) {
    console.log("\nDry run only — no changes made. Re-run with --confirm to actually delete the list above.");
    return;
  }

  if (deleteRows.length === 0) {
    console.log("\nNothing to delete — done.");
    return;
  }

  const deleteIds = deleteRows.map((r) => r.id);
  const result = await sql`
    DELETE FROM articles WHERE id IN (${sql.unsafe(deleteIds.map((id) => `'${id}'`).join(","))})
  `;
  console.log(`\nDeleted ${deleteRows.length} article(s). Cities, categories, and attractions were not touched.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Failed:", err.message);
    process.exit(1);
  });
