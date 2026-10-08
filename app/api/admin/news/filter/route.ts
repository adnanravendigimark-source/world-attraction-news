import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { dbErrorMessage } from "@/lib/db";
import { requireApiPermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { refilterItems } from "@/lib/news/filter";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Re-run the travel-relevance filter. Body: { onlyPending?: boolean }.
export async function POST(req: Request) {
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
  try {
    const count = await refilterItems({ onlyPending: !!body?.onlyPending, limit: 3000 });
    await logActivity(session, "news_refiltered", { type: "news_filter", id: "refilter", label: `${count} items` });
    return NextResponse.json({ ok: true, count });
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}
