import { withSiteRevalidate } from "@/lib/revalidateSite";
import { NextResponse } from "next/server";
import { costLast24h } from "@/lib/news/ops";
import { getSession } from "@/lib/session";
import { dbErrorMessage } from "@/lib/db";
import { requireApiPermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { cancelJob, countEligible, enqueueEligible, enqueueJob, jobStats, listJobs, loadAutomation, retryJob, runJobs, saveAutomation } from "@/lib/news/jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // AI steps; see lib/news/jobs.ts

export async function GET() {
  const session = await getSession();
  const denied = await requireApiPermission(session, "news", "read");
  if (denied) return denied;
  try {
    const [config, jobs, stats] = await Promise.all([loadAutomation(), listJobs(), jobStats()]);
    const eligible = await countEligible(config).catch(() => 0);
    const costToday = await costLast24h();
    return NextResponse.json({ config, jobs, stats, eligible, costToday });
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}

// POST { action: "settings", ...patch } | "enqueue" | "run" | "retry" {id} | "cancel" {id} | "start" {clusterId}
async function POSTHandler(req: Request) {
  const session = await getSession();
  const denied = await requireApiPermission(session, "news", "update");
  if (denied) return denied;
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const action = String(body?.action || "");
  try {
    if (action === "settings") {
      const config = await saveAutomation(body);
      await logActivity(session, "news_automation_updated", { type: "news", id: "automation", label: config.enabled ? "enabled" : "paused" });
      return NextResponse.json({ ok: true, config });
    }
    if (action === "enqueue") return NextResponse.json({ ok: true, ...(await enqueueEligible()) });
    if (action === "run") return NextResponse.json({ ok: true, ...(await runJobs()) });
    if (action === "start" && body?.clusterId) {
      const queued = await enqueueJob("research", String(body.clusterId));
      return NextResponse.json({ ok: true, queued });
    }
    if (action === "retry" && body?.id) {
      await retryJob(Number(body.id));
      return NextResponse.json({ ok: true });
    }
    if (action === "cancel" && body?.id) {
      await cancelJob(Number(body.id));
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err: any) {
    console.error("[api/admin/news/jobs] error:", err);
    const detail = process.env.NODE_ENV !== "production" && err instanceof Error ? err.message : undefined;
    return NextResponse.json({ error: dbErrorMessage(err), detail }, { status: 500 });
  }
}

export const POST = withSiteRevalidate(POSTHandler);
