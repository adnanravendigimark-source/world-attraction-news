import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { dbErrorMessage } from "@/lib/db";
import { requireApiPermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { checkDailyCap, getLatestResearch, runResearch } from "@/lib/news/research";
import { createDraftFromStory } from "@/lib/news/drafts";
import { recordDecision } from "@/lib/news/decisions";
import { MIN_FACTS, writeArticle } from "@/lib/news/writer";
import { checkAndRevise } from "@/lib/news/factcheck";
import { storyBusy } from "@/lib/news/jobs";
import { enrichArticle } from "@/lib/news/seo";
import { ensureImages } from "@/lib/news/imagegen";
import { computeQuality } from "@/lib/news/quality";
import { computeBlogQuality } from "@/lib/blogs/quality";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // AI steps; see lib/news/jobs.ts

// One step of "Create news draft". The browser calls these in order so each
// request stays under the time limit:
//   research -> write (draft + article + SEO + links) -> check (fact check,
//   one automatic revision) -> images -> quality
export async function POST(req: Request) {
  const session = await getSession();
  const denied = await requireApiPermission(session, "articles", "create");
  if (denied) return denied;
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const step = String(body?.step || "");
  const clusterId = String(body?.clusterId || "");
  const articleId = String(body?.articleId || "");
  try {
    if (step === "research") {
      if (!clusterId) return NextResponse.json({ error: "clusterId is required." }, { status: 400 });
      const existing = await getLatestResearch(clusterId);
      // Reuse finished research unless it came out too thin to write from
      // (for example a story researched before Google News links could be
      // opened); then research it again.
      const known = (existing?.facts?.important_facts.length ?? 0) + (existing?.facts?.confirmed_numbers.length ?? 0);
      if (existing?.status === "done" && known >= MIN_FACTS) return NextResponse.json({ ok: true, skipped: true, facts: known });
      if (!process.env.OPENAI_API_KEY?.trim()) return NextResponse.json({ error: "OPENAI_API_KEY is not set." }, { status: 400 });
      const cap = await checkDailyCap();
      if (!cap.ok) return NextResponse.json({ error: `Daily research limit reached (${cap.used}/${cap.cap}).` }, { status: 429 });
      const r = await runResearch(clusterId, session.email);
      if (r.status !== "done") return NextResponse.json({ error: r.error || "Research failed." }, { status: 400 });
      return NextResponse.json({ ok: true, facts: r.facts?.important_facts.length ?? 0 });
    }
    if (step === "write") {
      if (!clusterId) return NextResponse.json({ error: "clusterId is required." }, { status: 400 });
      if (await storyBusy(clusterId)) {
        return NextResponse.json({ error: "Automation is writing this story right now. Open it from Articles in a few minutes." }, { status: 409 });
      }
      const { article, created } = await createDraftFromStory(clusterId);
      if (created) {
        await logActivity(session, "news_draft_created", { type: "article", id: article.id, label: article.title });
        await recordDecision(clusterId, "drafted", session.email);
      }
      const w = await writeArticle(article.id);
      const e = await enrichArticle(article.id);
      return NextResponse.json({ ok: true, articleId: article.id, adminUrl: `/admin/articles/${article.id}`, wordCount: w.wordCount, links: e.links });
    }
    if (step === "check") {
      if (!articleId) return NextResponse.json({ error: "articleId is required." }, { status: 400 });
      const r = await checkAndRevise(articleId);
      if (r.revised) await enrichArticle(articleId);
      return NextResponse.json({ ok: true, verdict: r.check.verdict, issues: r.check.issues.length, revised: r.revised });
    }
    if (step === "images") {
      if (!articleId) return NextResponse.json({ error: "articleId is required." }, { status: 400 });
      const r = await ensureImages(articleId);
      return NextResponse.json({ ok: true, ...r });
    }
    if (step === "quality") {
      if (!articleId) return NextResponse.json({ error: "articleId is required." }, { status: 400 });
      return NextResponse.json({ ok: true, quality: await computeQuality(articleId) });
    }
    return NextResponse.json({ error: "Unknown step." }, { status: 400 });
  } catch (err: any) {
    console.error(`[api/admin/news/pipeline] ${step} failed:`, err);
    const msg = typeof err?.message === "string" && !/^(connect|ECONN|fetch failed)/i.test(err.message) ? err.message : dbErrorMessage(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const session = await getSession();
  const denied = await requireApiPermission(session, "news", "read");
  if (denied) return denied;
  const articleId = new URL(req.url).searchParams.get("articleId") || "";
  if (!articleId) return NextResponse.json({ error: "articleId is required." }, { status: 400 });
  try {
    // AI blog guides are scored with their own checklist (same as the Ready bar).
    const kind = (await sql`SELECT type, origin FROM articles WHERE id = ${articleId} LIMIT 1`)[0];
    const blog = !!kind && kind.type !== "news" && kind.origin === "ai_blog";
    return NextResponse.json({ quality: blog ? await computeBlogQuality(articleId) : await computeQuality(articleId) });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || dbErrorMessage(err) }, { status: 500 });
  }
}
