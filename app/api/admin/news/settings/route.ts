import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { dbErrorMessage } from "@/lib/db";
import { requireApiPermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { DEFAULT_TREND_CONFIG, loadTrendConfig, runTrendScoring, saveTrendConfig, validateTrendPatch } from "@/lib/news/trend";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const session = await getSession();
  const denied = await requireApiPermission(session, "news", "read");
  if (denied) return denied;
  try {
    return NextResponse.json({ trend: await loadTrendConfig(true), defaults: DEFAULT_TREND_CONFIG });
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}

// Body: { weights?, thresholds?, categoryWeights?, reset?: true }
export async function PUT(req: Request) {
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
  const patch = body?.reset
    ? { weights: DEFAULT_TREND_CONFIG.weights, thresholds: DEFAULT_TREND_CONFIG.thresholds, categoryWeights: DEFAULT_TREND_CONFIG.categoryWeights }
    : body;
  const invalid = validateTrendPatch(patch);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });
  try {
    const trend = await saveTrendConfig(patch);
    const { scored } = await runTrendScoring();
    await logActivity(session, "news_trend_settings_updated", { type: "news_settings", id: "trend", label: `${scored} stories re-scored` });
    return NextResponse.json({ ok: true, trend, scored });
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}
