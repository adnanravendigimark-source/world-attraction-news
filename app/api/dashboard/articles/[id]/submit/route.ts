import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getArticleById, submitDraftForReview } from "@/lib/articles";
import { checkOriginality } from "@/lib/originality";
import { dbErrorMessage } from "@/lib/db";

export const dynamic = "force-dynamic";

// Transitions a draft into the review queue. Always runs the originality
// check first and snapshots its result onto the article either way; if the
// content looks like it overlaps with something already on the site, this
// returns a soft `needsConfirmation` response instead of submitting
// outright, so the contributor sees the warning before it goes to review
// (per the product requirement to warn pre-submission, not silently
// auto-reject or auto-publish either way).
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const article = await getArticleById(params.id).catch(() => undefined);
  if (!article || article.authorId !== session.userId) {
    return NextResponse.json({ error: "Article not found." }, { status: 404 });
  }
  if (article.status !== "draft") {
    return NextResponse.json({ error: "This article has already been submitted." }, { status: 409 });
  }

  if (article.title.trim().length < 8) {
    return NextResponse.json({ error: "Title must be at least 8 characters." }, { status: 400 });
  }
  if (!article.excerpt.trim()) {
    return NextResponse.json({ error: "Add a short summary/excerpt." }, { status: 400 });
  }
  if (article.contentHtml.replace(/<[^>]*>/g, "").trim().length < 200) {
    return NextResponse.json(
      { error: "Article body must contain at least 200 characters of actual written content." },
      { status: 400 }
    );
  }
  if (!article.image) {
    return NextResponse.json({ error: "Upload a cover image." }, { status: 400 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // no body is fine — confirmDespiteFlag just defaults to false
  }
  const confirmDespiteFlag = Boolean(body?.confirmDespiteFlag);

  try {
    const originality = await checkOriginality(article.contentHtml, article.id);

    if (originality.flag && !confirmDespiteFlag) {
      return NextResponse.json({ ok: false, needsConfirmation: true, originality });
    }

    const updated = await submitDraftForReview(article.id, { score: originality.score, flag: originality.flag });
    return NextResponse.json({ ok: true, article: updated, originality });
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}
