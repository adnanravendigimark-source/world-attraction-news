import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { dbErrorMessage } from "@/lib/db";
import { requireApiPermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { enrichArticle } from "@/lib/news/seo";
import { factCheckArticle, getFactCheck, overrideFactCheck, writeArticle } from "@/lib/news/writer";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const session = await getSession();
  const denied = await requireApiPermission(session, "articles", "update");
  if (denied) return denied;
  const articleId = new URL(req.url).searchParams.get("articleId") || "";
  if (!articleId) return NextResponse.json({ error: "articleId is required." }, { status: 400 });
  return NextResponse.json({ check: await getFactCheck(articleId) });
}

// POST { articleId, action: "write" | "check" | "override" }
export async function POST(req: Request) {
  const session = await getSession();
  const denied = await requireApiPermission(session, "articles", "update");
  if (denied || !session) return denied;
  const body = await req.json().catch(() => null);
  const articleId = String(body?.articleId || "");
  const action = String(body?.action || "");
  if (!articleId) return NextResponse.json({ error: "articleId is required." }, { status: 400 });
  try {
    if (action === "write") {
      const r = await writeArticle(articleId);
      await enrichArticle(articleId);
      await logActivity(session, "news_article_written", { type: "article", id: articleId, label: `AI draft, fact check ${r.check.verdict}` });
      return NextResponse.json({ ok: true, ...r });
    }
    if (action === "check") {
      return NextResponse.json({ ok: true, check: await factCheckArticle(articleId) });
    }
    if (action === "override") {
      await overrideFactCheck(articleId);
      await logActivity(session, "news_factcheck_overridden", { type: "article", id: articleId, label: "fact check override" });
      return NextResponse.json({ ok: true, check: await getFactCheck(articleId) });
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err: any) {
    console.error("[api/admin/news/write] error:", err);
    const msg = typeof err?.message === "string" ? err.message : "";
    const known = /OpenAI|research|short|long|Unpublish|linked|unreadable|OPENAI/i.test(msg);
    return NextResponse.json({ error: known ? msg : dbErrorMessage(err), detail: process.env.NODE_ENV !== "production" ? msg : undefined }, { status: known ? 400 : 500 });
  }
}
