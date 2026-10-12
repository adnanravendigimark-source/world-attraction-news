import { NextResponse } from "next/server";
import { enqueueEligible, loadAutomation, runJobs } from "@/lib/news/jobs";
import { sendAlerts, sendDailySummary } from "@/lib/news/ops";
import { runBlogAutomation } from "@/lib/blogs/automation";

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
  const started = Date.now();
  try {
    const cfg = await loadAutomation();
    const queued = cfg.enabled ? await enqueueEligible(cfg) : { queued: 0, remaining: 0 };
    // Jobs already in the queue are worked even if automation was just paused,
    // except nothing new is added.
    const ran = await runJobs();
    // Track B7: background blog writing, refresh checks and news ideas, in the time left.
    const blogs = await runBlogAutomation({ budgetMs: Math.max(0, 270_000 - (Date.now() - started)) }).catch(() => null);
    // Phases 13–14: alert emails (6-hourly at most) and the daily summary
    // of drafts ready to publish (once a day, after 07:00 UTC).
    const alerts = await sendAlerts(cfg.dailyCostCapUsd).catch(() => []);
    const summary = new Date().getUTCHours() >= 7 ? await sendDailySummary(cfg.dailyCostCapUsd).catch(() => false) : false;
    return NextResponse.json({ ok: true, enabled: cfg.enabled, ...queued, ...ran, blogs, alerts, summary });
  } catch (err) {
    console.error("[cron/news-jobs] error:", err);
    return NextResponse.json({ ok: false, error: "Job run failed." }, { status: 500 });
  }
}
