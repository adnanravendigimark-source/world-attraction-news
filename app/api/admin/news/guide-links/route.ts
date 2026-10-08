import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { requireApiPermission } from "@/lib/permissions";
import { sql } from "@/lib/db";
import { loadGuideItems, suggestLinks } from "@/lib/news/guidelinks";

export const dynamic = "force-dynamic";

// POST { html } or { articleId } → link suggestions to World Attraction Guide.
export async function POST(req: Request) {
  const session = await getSession();
  const denied = await requireApiPermission(session, "articles", "update");
  if (denied) return denied;
  const body = await req.json().catch(() => null);
  let html = typeof body?.html === "string" ? body.html : "";
  if (!html && body?.articleId) {
    const rows = await sql`SELECT content_html FROM articles WHERE id = ${String(body.articleId)} AND type = 'news' LIMIT 1`;
    html = String(rows[0]?.content_html || "");
  }
  if (!html) return NextResponse.json({ error: "No article text to check." }, { status: 400 });
  try {
    const items = await loadGuideItems();
    return NextResponse.json({ suggestions: suggestLinks(html, items), guideItems: items.length });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Couldn't load guide links." }, { status: 502 });
  }
}
