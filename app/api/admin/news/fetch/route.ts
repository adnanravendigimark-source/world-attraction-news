import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { dbErrorMessage } from "@/lib/db";
import { requireApiPermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { runFetch } from "@/lib/news/collector";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Manual "Fetch now". Body: {} fetches every active source; { sourceId } tests one.
export async function POST(req: Request) {
  const session = await getSession();
  const denied = await requireApiPermission(session, "news", "update");
  if (denied) return denied;
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    /* empty body is fine */
  }
  try {
    const summary = await runFetch({
      trigger: body?.sourceId ? "manual-single" : "manual",
      force: true,
      sourceId: body?.sourceId ? String(body.sourceId) : undefined,
    });
    await logActivity(session, "news_fetch_run", { type: "news_fetch", id: String(summary.runId ?? "0"), label: `${summary.itemsNew} new` });
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    console.error("[api/admin/news/fetch] error:", err);
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}
