import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { dbErrorMessage } from "@/lib/db";
import { requireApiPermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { enrichArticle } from "@/lib/news/seo";
import { writeArticle, writeHighlights } from "@/lib/news/writer";
import { checkAndRevise, factCheckArticle, getFactCheck, overrideFactCheck } from "@/lib/news/factcheck";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // AI steps; see lib/news/jobs.ts

export async function GET(req: Request) {
  const session = await getSession();
  const denied = await requireApiPermission(session, "articles", "update");
  if (denied) return denied;
  const articleId = new URL(req.url).searchParams.get("articleId") || "";
  if (!articleId) return NextResponse.json({ error: "articleId is required." }, { status: 400 });
  return NextResponse.json({ check: await getFactCheck(articleId) });
}

// POST { articleId, action }
//   write    AI writes body + SEO fields (no check; call "verify" next)
//   verify   fact check + one automatic revision if it fails
//   check    fact check only (never changes the article)
//   override { reason } allow publishing despite a failed check
//   highlights  AI writes Key Updates / What Travelers Should Do only, then checks them
export async function POST(req: Request) {
  const session = await getSession();
  const denied = await requireApiPermission(session, "articles", "update");
  if (denied) return denied;
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const articleId = String(body?.articleId || "");
  const action = String(body?.action || "");
  if (!articleId) return NextResponse.json({ error: "articleId is required." }, { status: 400 });
  try {
    if (action === "write") {
      const r = await writeArticle(articleId);
      await enrichArticle(articleId);
      await logActivity(session, "news_article_written", { type: "article", id: articleId, label: `AI draft, ${r.wordCount} words` });
      return NextResponse.json({ ok: true, ...r });
    }
    if (action === "verify") {
      const r = await checkAndRevise(articleId);
      if (r.revised) await enrichArticle(articleId);
      return NextResponse.json({ ok: true, check: r.check, revised: r.revised });
    }
    if (action === "highlights") {
      const r = await writeHighlights(articleId);
      await logActivity(session, "news_highlights_written", { type: "article", id: articleId, label: `AI key updates (${r.keyUpdates}) and steps (${r.travelerSteps})` });
      return NextResponse.json({ ok: true, ...r, check: await getFactCheck(articleId) });
    }
    if (action === "check") {
      return NextResponse.json({ ok: true, check: await factCheckArticle(articleId) });
    }
    if (action === "override") {
      const reason = String(body?.reason || "");
      await overrideFactCheck(articleId, reason, session.email);
      await logActivity(session, "news_factcheck_overridden", { type: "article", id: articleId, label: `fact check override: ${reason.slice(0, 80)}` });
      return NextResponse.json({ ok: true, check: await getFactCheck(articleId) });
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err: any) {
    console.error("[api/admin/news/write] error:", err);
    const msg = typeof err?.message === "string" ? err.message : "";
    const known = /OpenAI|research|short|long|Unpublish|linked|unreadable|OPENAI|reason|model|database update/i.test(msg);
    return NextResponse.json({ error: known ? msg : dbErrorMessage(err), detail: process.env.NODE_ENV !== "production" ? msg : undefined }, { status: known ? 400 : 500 });
  }
}
