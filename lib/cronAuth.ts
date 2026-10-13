import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

// Shared guard for /api/cron/*. Vercel Cron sends "Authorization: Bearer
// <CRON_SECRET>" when CRON_SECRET is set in the project's environment.
//
// Fails CLOSED in production: without a CRON_SECRET anyone could trigger the
// jobs (and their OpenAI spend). Local `next dev` still runs without one.
// Returns a response to send back when the request is not allowed, or null.
export function cronDenied(req: Request, env: { secret?: string; production?: boolean } = {}): NextResponse | null {
  const secret = (env.secret ?? process.env.CRON_SECRET ?? "").trim();
  const production = env.production ?? (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production");
  if (!secret) {
    if (!production) return null;
    console.error("[cron] CRON_SECRET is not set; refusing to run cron jobs in production.");
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  }
  const given = Buffer.from(req.headers.get("authorization") || "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
