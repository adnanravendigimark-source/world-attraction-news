import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { dbErrorMessage, sql } from "@/lib/db";
import { requireApiPermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { listStories } from "@/lib/news/stories";
import { mergeDuplicateClusters, resetClustering, runClustering } from "@/lib/news/cluster";
import { runTrendScoring } from "@/lib/news/trend";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const session = await getSession();
  const denied = await requireApiPermission(session, "news", "read");
  if (denied) return denied;
  const sp = new URL(req.url).searchParams;
  try {
    return NextResponse.json(
      await listStories({
        q: sp.get("q") || "",
        category: sp.get("category") || "",
        minSources: Number(sp.get("minSources")) || 1,
        status: sp.get("status") || "",
        limit: Number(sp.get("limit")) || 50,
      })
    );
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}

// Body: { action: "cluster" | "rebuild" } or { action: "status", id, status }
export async function POST(req: Request) {
  const session = await getSession();
  const denied = await requireApiPermission(session, "news", "update");
  if (denied) return denied;
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  try {
    if (body.action === "status") {
      if (!body.id || !["new", "shortlisted", "ignored"].includes(body.status)) {
        return NextResponse.json({ error: "Invalid request." }, { status: 400 });
      }
      await sql`UPDATE story_clusters SET status = ${body.status} WHERE id = ${String(body.id)}`;
      return NextResponse.json({ ok: true });
    }
    if (body.action === "score") {
      const r = await runTrendScoring();
      return NextResponse.json({ ok: true, scored: r.scored });
    }
    if (body.action === "rebuild") await resetClustering();
    const grouped = await runClustering();
    const { merged } = await mergeDuplicateClusters();
    const result = { ...grouped, merged };
    await runTrendScoring();
    await logActivity(session, body.action === "rebuild" ? "news_clusters_rebuilt" : "news_clustered", {
      type: "news_cluster",
      id: "run",
      label: `${result.newClusters} new, ${result.assigned} items, ${result.merged} duplicate stories merged`,
    });
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    console.error("[api/admin/news/stories] error:", err);
    // Surface the raw cause outside production so schema gaps are obvious.
    const detail = process.env.NODE_ENV !== "production" && err instanceof Error ? err.message : undefined;
    return NextResponse.json({ error: dbErrorMessage(err), detail }, { status: 500 });
  }
}
