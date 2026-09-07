// One-off maintenance script: permanently deletes EVERY article, of any
// status (draft, pending, changes_requested, rejected, approved, scheduled,
// published, unpublished — all of them). Nothing else is touched: cities,
// countries, attractions, categories, and user accounts are left exactly as
// they are.
//
// Safe by design:
//   - Defaults to a DRY RUN. It only prints what it *would* delete.
//   - Add --confirm to actually run the DELETE. There is no undo.
//
// Cascades handled automatically by the DB schema (all ON DELETE CASCADE —
// see scripts/setup-db.mjs): article_revisions, article_reviews,
// article_views. No other table has a foreign key into articles — a few
// (activity_log.target_id, notifications.link) may still mention a deleted
// article's id/URL as plain text after this runs, which is expected and
// harmless (a historical log entry, not a live reference).
//
// How to run it (from the project root, wherever DATABASE_URL is reachable —
// this has to be run from your own machine or CI, not from an AI sandbox):
//   node scripts/delete-all-articles.mjs             # dry run
//   node scripts/delete-all-articles.mjs --confirm   # actually delete everything

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

const confirmed = process.argv.slice(2).includes("--confirm");

function formatRow(a) {
  const status = a.status.toUpperCase().padEnd(11);
  const date = a.published_at ? new Date(a.published_at).toISOString().slice(0, 10) : "—".padEnd(10);
  return `  [${status}] ${date}  ${a.title}  (/${a.city_slug || "?"}/${a.slug})`;
}

async function main() {
  const rows = await sql`
    SELECT a.id, a.slug, a.title, a.status, a.published_at, c.slug AS city_slug
    FROM articles a
    LEFT JOIN cities c ON c.id = a.city_id
    ORDER BY a.published_at DESC NULLS LAST
  `;

  console.log(`\n${confirmed ? "Deleting" : "Would delete"} ${rows.length} article(s) — ALL of them:`);
  if (rows.length === 0) console.log("  (none — the articles table is already empty)");
  rows.forEach((a) => console.log(formatRow(a)));

  if (!confirmed) {
    console.log("\nDry run only — no changes made. Re-run with --confirm to actually delete everything listed above.");
    return;
  }

  if (rows.length === 0) {
    console.log("\nNothing to delete — done.");
    return;
  }

  await sql`DELETE FROM articles`;
  console.log(`\nDeleted all ${rows.length} article(s) and their revisions/reviews/views (cascade).`);
  console.log("Cities, countries, attractions, categories, and user accounts were not touched.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Failed:", err.message);
    process.exit(1);
  });
