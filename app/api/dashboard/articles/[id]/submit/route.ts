import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getArticleById, submitDraftForReview } from "@/lib/articles";
import { runModerationChecks } from "@/lib/moderation";
import { recordRevision } from "@/lib/revisions";
import { notifyArticleSubmitted } from "@/lib/notifications";
import { dbErrorMessage } from "@/lib/db";

export const dynamic = "force-dynamic";

// Transitions a draft (or a changes_requested article being resubmitted)
// into the review queue. Always runs the full moderation check first
// (duplicate/similarity, spam, inappropriate-content, quality, AI-content
// signal — see lib/moderation.ts) and snapshots the result onto the
// article either way; if the duplicate-content check specifically looks
// like it overlaps with something already on the site, this returns a
// soft `needsConfirmation` response instead of submitting outright, so the
// contributor sees the warning before it goes to review. The other signals
// (spam/quality/AI) never block submission — they're admin-review-only.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const article = await getArticleById(params.id).catch(() => undefined);
  if (!article || article.authorId !== session.userId) {
    return NextResponse.json({ error: "Article not found." }, { status: 404 });
  }
  // 'rejected' is resubmittable too — the dashboard article detail page,
  // edit page, and ArticleEditor's own "Resubmit" button/confirm dialog
  // all treat a rejected article as something the contributor can revise
  // and send back for review, so the guard here has to allow it (see the
  // matching WHERE clause in lib/articles.ts's submitDraftForReview).
  if (article.status !== "draft" && article.status !== "changes_requested" && article.status !== "rejected") {
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
    const signals = await runModerationChecks({
      title: article.title,
      excerpt: article.excerpt,
      contentHtml: article.contentHtml,
      excludeArticleId: article.id,
    });

    if (signals.duplicate.flag && !confirmDespiteFlag) {
      return NextResponse.json({ ok: false, needsConfirmation: true, originality: signals.duplicate });
    }

    const updated = await submitDraftForReview(article.id, {
      score: signals.duplicate.score,
      flag: signals.duplicate.flag,
      signals,
    });

    await recordRevision({
      articleId: article.id,
      editorId: session.userId,
      editorEmail: session.email,
      editorRole: "contributor",
      title: updated.title,
      excerpt: updated.excerpt,
      contentHtml: updated.contentHtml,
      image: updated.image,
      imageAlt: updated.imageAlt,
      changeSummary:
        article.status === "changes_requested"
          ? "Resubmitted after changes requested"
          : article.status === "rejected"
            ? "Resubmitted after rejection"
            : "Submitted for review",
    });

    await notifyArticleSubmitted({ id: session.userId, email: session.email }, { id: updated.id, title: updated.title });

    return NextResponse.json({ ok: true, article: updated, originality: signals.duplicate });
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}
