import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { dbErrorMessage } from "@/lib/db";
import { requireApiPermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { calibrationReport } from "@/lib/news/decisions";
import { DEFAULT_TREND_CONFIG, loadTrendConfig, runTrendScoring, saveTrendConfig, validateTrendPatch } from "@/lib/news/trend";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const session = await getSession();
  const denied = await requireApiPermission(session, "news", "read");
  if (denied) return denied;
  try {
    const [trend, calibration] = await Promise.all([loadTrendConfig(true), calibrationReport(14)]);
    return NextResponse.json({ trend, defaults: DEFAULT_TREND_CONFIG, calibration });
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}

// Body: { weights?, thresholds?, categoryWeights?, freshnessBands?, staleScore?, sourceCurve?, reset?: true }
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
    ? {
        weights: DEFAULT_TREND_CONFIG.weights,
        thresholds: DEFAULT_TREND_CONFIG.thresholds,
        categoryWeights: DEFAULT_TREND_CONFIG.categoryWeights,
        freshnessBands: DEFAULT_TREND_CONFIG.freshnessBands,
        staleScore: DEFAULT_TREND_CONFIG.staleScore,
        sourceCurve: DEFAULT_TREND_CONFIG.sourceCurve,
      }
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
