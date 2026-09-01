import { sql } from "./db";

// Real, database-backed rate limiting (see the `rate_limits` table added
// by scripts/setup-db.mjs's createPhase5SecurityTables()) — deliberately
// not an in-memory counter, because serverless functions don't share
// memory across instances, so an in-memory limiter would silently do
// nothing in production. This one is enforced by an atomic single-statement
// Postgres upsert, so it holds under concurrent requests and across
// instances.
export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

// `key` should already encode both the caller (IP) and the action being
// limited, e.g. `login:203.0.113.4` — different actions must never share a
// bucket, or hammering one endpoint would lock a user out of another.
export async function checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  try {
    const rows = await sql`
      INSERT INTO rate_limits (key, count, window_start)
      VALUES (${key}, 1, now())
      ON CONFLICT (key) DO UPDATE SET
        count = CASE
          WHEN rate_limits.window_start < now() - (${windowSeconds} || ' seconds')::interval THEN 1
          ELSE rate_limits.count + 1
        END,
        window_start = CASE
          WHEN rate_limits.window_start < now() - (${windowSeconds} || ' seconds')::interval THEN now()
          ELSE rate_limits.window_start
        END
      RETURNING count, window_start
    `;
    const row = rows[0];
    const count = Number(row.count);
    if (count > limit) {
      const windowStart = row.window_start instanceof Date ? row.window_start : new Date(row.window_start);
      const elapsedMs = Date.now() - windowStart.getTime();
      const retryAfterSeconds = Math.max(1, Math.ceil(windowSeconds - elapsedMs / 1000));
      return { allowed: false, retryAfterSeconds };
    }
    return { allowed: true, retryAfterSeconds: 0 };
  } catch (err) {
    // Fail open: a rate-limit table hiccup (e.g. migration not yet run on
    // an older database) must never take down login/signup entirely.
    console.error("[rateLimit] check failed, allowing request:", err);
    return { allowed: true, retryAfterSeconds: 0 };
  }
}

// Best-effort real client IP extraction behind Vercel's proxy. Falls back
// to a shared bucket key ("unknown") only if no header is present at all
// (e.g. local dev without a proxy) — still functional, just less precise.
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}
