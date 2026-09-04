import { neon } from "@neondatabase/serverless";

// Neon's HTTP driver — each `sql` call is one stateless HTTP request, safe
// to use from serverless functions without exhausting a connection pool.
// Requires DATABASE_URL (Neon dashboard → Connection Details → "Pooled connection").
if (!process.env.DATABASE_URL) {
  console.warn(
    "[db] DATABASE_URL is not set — reads will return empty results and every write will fail until it's configured."
  );
}

// Fallback to a syntactically valid postgresql connection URI so neon() constructor
// does not crash during import/build when DATABASE_URL is not defined in the environment.
const connectionUrl =
  process.env.DATABASE_URL?.trim() ||
  "postgresql://postgres:postgres@localhost:5432/postgres";

const neonClient = neon(connectionUrl, {
  fetchOptions: { cache: "no-store" },
});

export const sql = ((strings: any, ...values: any[]) => {
  if (!process.env.DATABASE_URL) {
    return Promise.resolve([]);
  }
  return neonClient(strings, ...values);
}) as unknown as typeof neonClient;

export const DB_ERROR_MESSAGE =
  "Couldn't save — the database couldn't be reached. Check that DATABASE_URL is set correctly (and that your Neon project is active), then try again.";

export function dbErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/column .* does not exist|relation .* does not exist/i.test(message)) {
    return "Couldn't save — the database is missing a column or table this feature needs. Run `node scripts/setup-db.mjs` against this database (see README), then try again.";
  }
  return DB_ERROR_MESSAGE;
}
