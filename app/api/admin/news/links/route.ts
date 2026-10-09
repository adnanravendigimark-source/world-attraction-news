import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { dbErrorMessage } from "@/lib/db";
import { requireApiPermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { getLinks, linkAction, refreshLinks } from "@/lib/news/internalLinks";

export const dynamic = "force-dynamic";

// GET ?articleId= → { links } (links to this site's own pages)
export async function GET(req: Request) {
  const session = await getSession();
  const denied = await requireApiPermission(session, "articles", "update");
  if (denied) return denied;
  const articleId = new URL(req.url).searchParams.get("articleId") || "";
  if (!articleId) return NextResponse.json({ error: "articleId is required." }, { status: 400 });
  try {
    return NextResponse.json({ links: await getLinks(articleId) });
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}

// POST { articleId, refresh: true } → plan the links again
// POST { articleId, linkId, action: "remove" | "restore" | "to_text" | "to_related" }
export async function POST(req: Request) {
  const session = await getSession();
  const denied = await requireApiPermission(session, "articles", "update");
  if (denied) return denied;
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const articleId = String(body?.articleId || "");
  if (!articleId) return NextResponse.json({ error: "articleId is required." }, { status: 400 });
  try {
    if (body?.refresh) {
      const r = await refreshLinks(articleId, session.email);
      await logActivity(session, "news_links_refreshed", { type: "article", id: articleId, label: `${r.inText.length} in text, ${r.related.length} related` });
      return NextResponse.json({ ok: true, links: await getLinks(articleId) });
    }
    const action = String(body?.action || "");
    if (!["remove", "restore", "to_text", "to_related"].includes(action) || !Number.isFinite(Number(body?.linkId))) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    const links = await linkAction(articleId, Number(body.linkId), action as any, session.email);
    await logActivity(session, `news_link_${action}`, { type: "article", id: articleId, label: String(body.linkId) });
    return NextResponse.json({ ok: true, links });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || dbErrorMessage(err) }, { status: 400 });
  }
}
