import { withSiteRevalidate } from "@/lib/revalidateSite";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { dbErrorMessage } from "@/lib/db";
import { requireApiPermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { checkDailyCap, getLatestResearch, runResearch } from "@/lib/news/research";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // AI steps; see lib/news/jobs.ts

export async function GET(req: Request) {
  const session = await getSession();
  const denied = await requireApiPermission(session, "news", "read");
  if (denied) return denied;
  const clusterId = new URL(req.url).searchParams.get("clusterId") || "";
  if (!clusterId) return NextResponse.json({ error: "clusterId is required." }, { status: 400 });
  try {
    return NextResponse.json({ research: await getLatestResearch(clusterId) });
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}

// Body: { clusterId }
async function POSTHandler(req: Request) {
  const session = await getSession();
  const denied = await requireApiPermission(session, "news", "update");
  if (denied) return denied;
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const clusterId = String(body?.clusterId || "");
  if (!clusterId) return NextResponse.json({ error: "clusterId is required." }, { status: 400 });
  try {
    if (!process.env.OPENAI_API_KEY?.trim()) {
      return NextResponse.json({ error: "OPENAI_API_KEY is not set. Add it to your environment and restart." }, { status: 400 });
    }
    const cap = await checkDailyCap();
    if (!cap.ok) {
      return NextResponse.json({ error: `Daily research limit reached (${cap.used}/${cap.cap}). Raise NEWS_RESEARCH_DAILY_CAP to allow more.` }, { status: 429 });
    }
    const research = await runResearch(clusterId, session.email);
    await logActivity(session, research.status === "done" ? "news_research_done" : "news_research_failed", {
      type: "news_cluster",
      id: clusterId,
      label: research.status === "done" ? "facts extracted" : research.error.slice(0, 80),
    });
    return NextResponse.json({ ok: research.status === "done", research });
  } catch (err: any) {
    console.error("[api/admin/news/research] error:", err);
    const detail = process.env.NODE_ENV !== "production" && err instanceof Error ? err.message : undefined;
    return NextResponse.json({ error: err?.message === "Story not found." ? err.message : dbErrorMessage(err), detail }, { status: 500 });
  }
}

export const POST = withSiteRevalidate(POSTHandler);
