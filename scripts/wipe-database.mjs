// FULL DATABASE WIPE. Empties every table EXCEPT `users` (so admin and
// contributor accounts still work and everyone can still log in afterward).
// Table structure/schema is untouched — only rows are deleted. This is as
// close to "brand new database" as you can get without dropping tables.
//
// Wiped: articles, article_revisions, article_reviews, article_views,
// attractions, cities, countries, categories, notifications, activity_log,
// contact_messages, newsletter_subscribers, rate_limits, settings,
// indexing_settings.
//
// NOT wiped: users (accounts/logins). Any user that had a home city
// (users.city_id) will simply have that reset to NULL by the database's own
// foreign key rule — the account itself is untouched.
//
// Every statement below is a literal, hardcoded tagged-template query (no
// dynamic table-name interpolation) — @neondatabase/serverless's `sql`
// function is *only* a tagged-template query runner in this project's
// installed version (no `.query()` / `.unsafe()` helper), so table names
// can't be parameterized. Writing each one out explicitly is the reliable
// way to do this with that driver.
//
// Safe by design:
//   - Defaults to a DRY RUN. It only prints current row counts per table.
//   - Add --confirm to actually run the deletes. There is no undo.
//
// How to run it (from the project root, wherever DATABASE_URL is reachable):
//   node scripts/wipe-database.mjs             # dry run — just shows counts
//   node scripts/wipe-database.mjs --confirm   # actually wipes everything

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

// Each entry: table label, a COUNT query, and a DELETE query. Order matters
// — children before parents — so nothing hits a foreign-key error even if
// run against a database that already had some of these cleared out (e.g.
// articles already wiped by a previous script run).
const STEPS = [
  { table: "article_views", count: () => sql`SELECT COUNT(*)::int AS n FROM article_views`, del: () => sql`DELETE FROM article_views` },
  { table: "article_reviews", count: () => sql`SELECT COUNT(*)::int AS n FROM article_reviews`, del: () => sql`DELETE FROM article_reviews` },
  { table: "article_revisions", count: () => sql`SELECT COUNT(*)::int AS n FROM article_revisions`, del: () => sql`DELETE FROM article_revisions` },
  { table: "articles", count: () => sql`SELECT COUNT(*)::int AS n FROM articles`, del: () => sql`DELETE FROM articles` },
  { table: "attractions", count: () => sql`SELECT COUNT(*)::int AS n FROM attractions`, del: () => sql`DELETE FROM attractions` },
  { table: "notifications", count: () => sql`SELECT COUNT(*)::int AS n FROM notifications`, del: () => sql`DELETE FROM notifications` },
  { table: "activity_log", count: () => sql`SELECT COUNT(*)::int AS n FROM activity_log`, del: () => sql`DELETE FROM activity_log` },
  { table: "contact_messages", count: () => sql`SELECT COUNT(*)::int AS n FROM contact_messages`, del: () => sql`DELETE FROM contact_messages` },
  { table: "newsletter_subscribers", count: () => sql`SELECT COUNT(*)::int AS n FROM newsletter_subscribers`, del: () => sql`DELETE FROM newsletter_subscribers` },
  { table: "rate_limits", count: () => sql`SELECT COUNT(*)::int AS n FROM rate_limits`, del: () => sql`DELETE FROM rate_limits` },
  { table: "settings", count: () => sql`SELECT COUNT(*)::int AS n FROM settings`, del: () => sql`DELETE FROM settings` },
  { table: "indexing_settings", count: () => sql`SELECT COUNT(*)::int AS n FROM indexing_settings`, del: () => sql`DELETE FROM indexing_settings` },
  { table: "cities", count: () => sql`SELECT COUNT(*)::int AS n FROM cities`, del: () => sql`DELETE FROM cities` },
  { table: "countries", count: () => sql`SELECT COUNT(*)::int AS n FROM countries`, del: () => sql`DELETE FROM countries` },
  { table: "categories", count: () => sql`SELECT COUNT(*)::int AS n FROM categories`, del: () => sql`DELETE FROM categories` },
];

async function main() {
  console.log(`\n${confirmed ? "Wiping" : "Would wipe"} every table except users:\n`);

  const counts = {};
  for (const step of STEPS) {
    const rows = await step.count();
    counts[step.table] = rows[0]?.n ?? 0;
    console.log(`  ${step.table.padEnd(24)} ${counts[step.table]} row(s)`);
  }
  const totalRows = Object.values(counts).reduce((a, b) => a + b, 0);

  const userRows = await sql`SELECT COUNT(*)::int AS n FROM users`;
  const userCount = userRows[0]?.n ?? 0;
  console.log(`\n  users${" ".repeat(20)} ${userCount} row(s) — NOT touched\n`);

  if (!confirmed) {
    console.log(`Dry run only — no changes made. ${totalRows} row(s) total would be deleted.`);
    console.log("Re-run with --confirm to actually wipe the database.");
    return;
  }

  if (totalRows === 0) {
    console.log("Nothing to delete — every table (besides users) is already empty.");
    return;
  }

  for (const step of STEPS) {
    if (counts[step.table] === 0) continue;
    await step.del();
    console.log(`  Cleared ${step.table} (${counts[step.table]} row(s))`);
  }

  // `settings` is a singleton config row (id = 1) the app expects to exist —
  // put a fresh default row back so /admin/settings doesn't hit a missing row.
  await sql`INSERT INTO settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING`;

  console.log(`\nDatabase wiped. ${totalRows} row(s) deleted across ${STEPS.length} tables.`);
  console.log("User accounts were left untouched — everyone can still log in.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Failed:", err.message);
    process.exit(1);
  });
