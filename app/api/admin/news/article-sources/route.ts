import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { dbErrorMessage, sql } from "@/lib/db";
import { requireApiPermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { getArticleSources } from "@/lib/articles";
import { validateSourceList, type SourceInput } from "@/lib/news/articleSources";

export const dynamic = "force-dynamic";

// GET ?articleId= → the sources listed under a news article.
export async function GET(req: Request) {
  const session = await getSession();
  const denied = await requireApiPermission(session, "articles", "update");
  if (denied) return denied;
  const articleId = new URL(req.url).searchParams.get("articleId") || "";
  if (!articleId) return NextResponse.json({ error: "articleId is required." }, { status: 400 });
  return NextResponse.json({ sources: await getArticleSources(articleId) });
}

// PUT { articleId, sources: [{ title, url, publisher, isOfficial }] } replaces
// the whole list in the given order. Not allowed once the article is live.
export async function PUT(req: Request) {
  const session = await getSession();
  const denied = await requireApiPermission(session, "articles", "update");
  if (denied) return denied;
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const articleId = String(body?.articleId || "");
  if (!articleId) return NextResponse.json({ error: "articleId is required." }, { status: 400 });
  const checked = validateSourceList(body?.sources);
  if ("error" in checked) return NextResponse.json({ error: checked.error }, { status: 400 });
  try {
    const rows = await sql`SELECT status FROM articles WHERE id = ${articleId} AND type = 'news' LIMIT 1`;
    if (!rows[0]) return NextResponse.json({ error: "News article not found." }, { status: 404 });
    if (["published", "scheduled"].includes(rows[0].status)) {
      return NextResponse.json({ error: "Unpublish the article before changing its sources." }, { status: 400 });
    }
    const list: SourceInput[] = checked.sources;
    await sql`DELETE FROM article_sources WHERE article_id = ${articleId}`;
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      await sql`
        INSERT INTO article_sources (article_id, n, title, url, publisher, is_official)
        VALUES (${articleId}, ${i + 1}, ${s.title}, ${s.url}, ${s.publisher}, ${s.isOfficial})`;
    }
    await logActivity(session, "news_sources_updated", { type: "article", id: articleId, label: `${list.length} source(s)` });
    return NextResponse.json({ ok: true, sources: await getArticleSources(articleId) });
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}
