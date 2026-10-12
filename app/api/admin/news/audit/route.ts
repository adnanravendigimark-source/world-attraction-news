import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { dbErrorMessage } from "@/lib/db";
import { requireApiPermission } from "@/lib/permissions";
import { getArticleAudit } from "@/lib/news/audit";

export const dynamic = "force-dynamic";

// GET ?articleId= → the article's audit record (sources, facts, AI calls,
// fact check, revisions, decisions, approvals).
export async function GET(req: Request) {
  const session = await getSession();
  const denied = await requireApiPermission(session, "articles", "read");
  if (denied) return denied;
  const articleId = new URL(req.url).searchParams.get("articleId") || "";
  if (!articleId) return NextResponse.json({ error: "articleId is required." }, { status: 400 });
  try {
    return NextResponse.json({ audit: await getArticleAudit(articleId) });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || dbErrorMessage(err) }, { status: 500 });
  }
}
