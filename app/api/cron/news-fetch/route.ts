import { NextResponse } from "next/server";
import { runFetch } from "@/lib/news/collector";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Vercel Cron (see vercel.json) hits this every 30 minutes. Each source has
// its own check interval, so only sources that are due are fetched.
// Protected by CRON_SECRET exactly like /api/cron/publish-scheduled.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
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
