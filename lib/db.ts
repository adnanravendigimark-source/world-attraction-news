import { neon } from "@neondatabase/serverless";

// Neon's HTTP driver — each `sql` call is one stateless HTTP request, safe
// to use from serverless functions without exhausting a connection pool.
// Requires DATABASE_URL (Neon dashboard → Connection Details → "Pooled
// connection"). Until it's set, reads fail soft (empty results / seeded
// fallbacks where noted) and writes throw — surfaced via dbErrorMessage().
if (!process.env.DATABASE_URL) {
  console.warn(
    "[db] DATABASE_URL is not set — reads will return empty results and every write will fail until it's configured. See README.md."
  );
}

// IMPORTANT (learned the hard way on earlier projects): neon()'s HTTP
// driver executes every query as an internal fetch() call, and Next's App
// Router auto-caches server-side fetch() unless told not to. Without
// `fetchOptions: { cache: "no-store" }` here, Next can silently cache the
// *database query responses themselves* — a write still reaches Neon and
// succeeds, but a subsequent read (e.g. right after an admin approves an
// article) can be served from a stale cached query response instead of
// hitting the database again.
export const sql = neon(process.env.DATABASE_URL || "postgres://unset", {
  fetchOptions: { cache: "no-store" },
});

export const DB_ERROR_MESSAGE =
  "Couldn't save — the database couldn't be reached. Check that DATABASE_URL is set correctly (and that your Neon project is active), then try again.";

export function dbErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/column .* does not exist|relation .* does not exist/i.test(message)) {
    return "Couldn't save — the database is missing a column or table this feature needs. Run `node scripts/setup-db.mjs` against this database (see README), then try again.";
  }
  return DB_ERROR_MESSAGE;
}
