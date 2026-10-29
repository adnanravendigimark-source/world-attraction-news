import { withSiteRevalidate } from "@/lib/revalidateSite";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { dbErrorMessage } from "@/lib/db";
import { requireApiPermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import {
  DEFAULT_FILTER_CONFIG,
  loadFilterConfig,
  normalizeFilterConfig,
  refilterItems,
  resetFilterConfig,
  saveFilterConfig,
  scoreRelevance,
} from "@/lib/news/filter";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// The travel filter's thresholds and term lists.
export async function GET() {
  const session = await getSession();
  const denied = await requireApiPermission(session, "news", "read");
  if (denied) return denied;
  try {
    return NextResponse.json({ config: await loadFilterConfig(), defaults: DEFAULT_FILTER_CONFIG });
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}

// Save edited settings (or { reset: true }) and re-score stored items.
async function PUTHandler(req: Request) {
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
  try {
    let config;
    if (body?.reset) config = await resetFilterConfig();
    else {
      const n = normalizeFilterConfig(body?.config);
      if (n.error || !n.config) return NextResponse.json({ error: n.error }, { status: 400 });
      config = await saveFilterConfig(n.config);
    }
    const count = await refilterItems({ limit: 3000 });
    await logActivity(session, "news_filter_settings_updated", { type: "news_settings", id: "filter", label: `${count} items re-scored` });
    return NextResponse.json({ ok: true, config, count });
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}

// Re-run the travel-relevance filter. Body: { onlyPending?: boolean }, or
// { try: { title, description?, config? } } to score one headline without
// saving anything (config: unsaved settings from the editor).
async function POSTHandler(req: Request) {
  const session = await getSession();
  const denied = await requireApiPermission(session, "news", "update");
  if (denied) return denied;
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    /* empty body ok */
  }
  if (body?.try) {
    const title = String(body.try.title || "").trim();
    if (!title) return NextResponse.json({ error: "Enter a headline." }, { status: 400 });
    let config = await loadFilterConfig();
    if (body.try.config) {
      const n = normalizeFilterConfig(body.try.config);
      if (n.error || !n.config) return NextResponse.json({ error: n.error }, { status: 400 });
      config = n.config;
    }
    return NextResponse.json({ result: scoreRelevance({ title, description: String(body.try.description || "") }, config) });
  }
  try {
    const count = await refilterItems({ onlyPending: !!body?.onlyPending, limit: 3000 });
    await logActivity(session, "news_refiltered", { type: "news_filter", id: "refilter", label: `${count} items` });
    return NextResponse.json({ ok: true, count });
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}

export const POST = withSiteRevalidate(POSTHandler);
export const PUT = withSiteRevalidate(PUTHandler);
