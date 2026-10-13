import { NextResponse } from "next/server";
import { cronDenied } from "@/lib/cronAuth";
import { runFetch } from "@/lib/news/collector";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Vercel Cron (see vercel.json) hits this every 30 minutes. Each source has
// its own check interval, so only sources that are due are fetched.
// Protected by CRON_SECRET exactly like /api/cron/publish-scheduled.
export async function GET(req: Request) {
  const denied = cronDenied(req);
  if (denied) return denied;
  try {
    const summary = await runFetch({ trigger: "cron" });
    return NextResponse.json({
      ok: true,
      sourcesChecked: summary.sourcesChecked,
      itemsNew: summary.itemsNew,
      errors: summary.errors,
    });
  } catch (err) {
    console.error("[cron/news-fetch] error:", err);
    return NextResponse.json({ ok: false, error: "Fetch run failed." }, { status: 500 });
  }
}
