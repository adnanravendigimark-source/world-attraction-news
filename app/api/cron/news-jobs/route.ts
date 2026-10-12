import { NextResponse } from "next/server";
import { enqueueEligible, loadAutomation, runJobs } from "@/lib/news/jobs";
import { sendAlerts, sendDailySummary } from "@/lib/news/ops";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // AI steps; see lib/news/jobs.ts

// Vercel Cron (see vercel.json) runs this every 10 minutes: when automation is
// switched on it queues the best un-started stories, then works the queue.
// Drafts only reach Pending Review; nothing is published automatically.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  try {
    const cfg = await loadAutomation();
    const queued = cfg.enabled ? await enqueueEligible(cfg) : { queued: 0, remaining: 0 };
    // Jobs already in the queue are worked even if automation was just paused,
    // except nothing new is added.
    const ran = await runJobs();
    // Phases 13–14: alert emails (6-hourly at most) and the daily summary
    // of drafts ready to publish (once a day, after 07:00 UTC).
    const alerts = await sendAlerts(cfg.dailyCostCapUsd).catch(() => []);
    const summary = new Date().getUTCHours() >= 7 ? await sendDailySummary(cfg.dailyCostCapUsd).catch(() => false) : false;
    return NextResponse.json({ ok: true, enabled: cfg.enabled, ...queued, ...ran, alerts, summary });
  } catch (err) {
    console.error("[cron/news-jobs] error:", err);
    return NextResponse.json({ ok: false, error: "Job run failed." }, { status: 500 });
  }
}
