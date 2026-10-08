import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { dbErrorMessage } from "@/lib/db";
import { requireApiPermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { createNewsSource, getNewsSources, loadDefaultNewsSources, validateNewsSourceInput } from "@/lib/news/sources";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  const denied = await requireApiPermission(session, "news", "read");
  if (denied) return denied;
  try {
    return NextResponse.json({ sources: await getNewsSources() });
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getSession();
  const denied = await requireApiPermission(session, "news", "create");
  if (denied) return denied;
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  try {
    // { loadDefaults: true } adds the recommended starter sources.
    if (body?.loadDefaults) {
      const added = await loadDefaultNewsSources();
      await logActivity(session, "news_sources_defaults_loaded", { type: "news_source", id: "defaults", label: `${added} added` });
      return NextResponse.json({ ok: true, added, sources: await getNewsSources() });
    }
    const invalid = validateNewsSourceInput(body);
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });
    const source = await createNewsSource(body);
    await logActivity(session, "news_source_created", { type: "news_source", id: source.id, label: source.name });
    return NextResponse.json({ ok: true, source });
  } catch (err: any) {
    if (String(err?.message || "").includes("news_sources_feed_uniq")) {
      return NextResponse.json({ error: "A source with that feed URL already exists." }, { status: 409 });
    }
    console.error("[api/admin/news/sources] create error:", err);
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}
