import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { dbErrorMessage, sql } from "@/lib/db";
import { computeBlogQuality } from "@/lib/blogs/quality";
import { requireApiPermission } from "@/lib/permissions";
import { getArticleSources, newsPublishProblems } from "@/lib/articles";
import { computeQuality } from "@/lib/news/quality";
import { getFactCheck } from "@/lib/news/factcheck";
import { loadAutomation } from "@/lib/news/jobs";

export const dynamic = "force-dynamic";

// GET ?articleId= → everything the editor's Ready bar shows. "ready" is true
// only when the publish gate has nothing left to report, so it always agrees
// with what the Publish button will allow.
export async function GET(req: Request) {
  const session = await getSession();
  const denied = await requireApiPermission(session, "articles", "update");
  if (denied) return denied;
  const articleId = new URL(req.url).searchParams.get("articleId") || "";
  if (!articleId) return NextResponse.json({ error: "articleId is required." }, { status: 400 });
  try {
    const kind = (await sql`SELECT type, origin FROM articles WHERE id = ${articleId} LIMIT 1`)[0];
    const quality = kind && kind.type !== "news" && kind.origin === "ai_blog" ? await computeBlogQuality(articleId) : await computeQuality(articleId);
    const [problems, check, sources, cfg] = await Promise.all([
      newsPublishProblems(articleId, { quality }),
      getFactCheck(articleId),
      getArticleSources(articleId),
      loadAutomation(),
    ]);
    const byKey = Object.fromEntries(quality.checks.map((c) => [c.key, c]));
    return NextResponse.json({
      ready: problems.length === 0,
      problems,
      quality: { score: quality.score, min: cfg.minQuality, checks: quality.checks, overlap: quality.overlap },
      factCheck: check ? { verdict: check.verdict, stale: check.stale, overridden: check.overridden } : null,
      sources: { count: sources.length, official: sources.filter((s) => s.isOfficial).length },
      image: { ok: !!byKey.image?.ok && !!byKey.provenance?.ok, note: byKey.provenance?.note || byKey.image?.note || "" },
      links: { ok: !!byKey.links?.ok, note: byKey.links?.note || "" },
    });
  } catch (err: any) {
    const msg = typeof err?.message === "string" && /not found/i.test(err.message) ? err.message : dbErrorMessage(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
