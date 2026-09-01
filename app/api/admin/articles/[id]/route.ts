import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  getArticleById,
  reviewArticle,
  markUnderReview,
  publishArticle,
  unpublishArticle,
  scheduleArticle,
  cancelSchedule,
  adminUpdateArticle,
  updateEditorialFlags,
  deleteArticle,
} from "@/lib/articles";
import { runModerationChecks } from "@/lib/moderation";
import { recordReview } from "@/lib/reviews";
import { recordRevision, getRevisionById } from "@/lib/revisions";
import { findUserById } from "@/lib/users";
import {
  notifyArticleUnderReview,
  notifyChangesRequested,
  notifyArticleApproved,
  notifyArticleRejected,
  notifyArticleScored,
  notifyArticlePublished,
  notifyArticleUnpublished,
} from "@/lib/notifications";
import { logActivity } from "@/lib/activity";
import { dbErrorMessage } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const article = await getArticleById(params.id).catch(() => undefined);
  if (!article) return NextResponse.json({ error: "Article not found." }, { status: 404 });
  return NextResponse.json({ article });
}

// Single endpoint for every admin article action, dispatched by
// body.action — keeps the review-score-feedback flow, publish/schedule/
// unpublish toggles, editorial flags, revision restore, and general
// content edits all under one route.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const action = body.action;
  const before = await getArticleById(params.id).catch(() => undefined);
  if (!before) return NextResponse.json({ error: "Article not found." }, { status: 404 });
  const author = await findUserById(before.authorId).catch(() => undefined);

  try {
    if (action === "start_review") {
      const article = await markUnderReview(params.id);
      await logActivity(session, "article_marked_under_review", { type: "article", id: article.id, label: article.title });
      if (author) await notifyArticleUnderReview({ id: author.id, email: author.email }, { id: article.id, title: article.title });
      return NextResponse.json({ ok: true, article });
    }

    if (action === "review") {
      if (["published", "scheduled", "unpublished"].includes(before.status)) {
        return NextResponse.json(
          { error: "This article has already gone through publishing. Cancel its schedule or unpublish it first to change its review status." },
          { status: 400 }
        );
      }
      const status = ["approved", "rejected", "changes_requested"].includes(body.status) ? body.status : null;
      if (!status) return NextResponse.json({ error: "Choose Approve, Request Changes, or Reject." }, { status: 400 });
      let score: number | null = null;
      if (body.score !== null && body.score !== undefined && body.score !== "") {
        const n = Number(body.score);
        if (!Number.isFinite(n) || n < 0 || n > 10) {
          return NextResponse.json({ error: "Score must be a number between 0 and 10." }, { status: 400 });
        }
        score = n;
      }
      const feedback = (body.feedback || "").trim();
      const article = await reviewArticle(params.id, { status, score, feedback });

      await recordReview({
        articleId: article.id,
        adminId: session.userId,
        adminEmail: session.email,
        decision: status,
        score,
        feedback,
        moderationSignals: before.moderationSignals,
      });

      await logActivity(
        session,
        status === "approved" ? "article_approved" : status === "rejected" ? "article_rejected" : "article_changes_requested",
        { type: "article", id: article.id, label: article.title },
        { score, hasFeedback: Boolean(feedback) }
      );

      if (author) {
        if (status === "approved") await notifyArticleApproved({ id: author.id, email: author.email }, { id: article.id, title: article.title });
        else if (status === "rejected") await notifyArticleRejected({ id: author.id, email: author.email }, { id: article.id, title: article.title }, feedback);
        else await notifyChangesRequested({ id: author.id, email: author.email }, { id: article.id, title: article.title }, feedback);
        if (score !== null) {
          await logActivity(session, "article_scored", { type: "article", id: article.id, label: article.title }, { score });
          await notifyArticleScored({ id: author.id, email: author.email }, { id: article.id, title: article.title }, score);
        }
      }
      return NextResponse.json({ ok: true, article });
    }

    if (action === "publish") {
      const article = await publishArticle(params.id);
      await logActivity(session, "article_published", { type: "article", id: article.id, label: article.title });
      if (author) {
        const url = `/cities/${before.citySlug}/${article.slug}`;
        await notifyArticlePublished({ id: author.id, email: author.email }, { id: article.id, title: article.title, url });
      }
      return NextResponse.json({ ok: true, article });
    }

    if (action === "schedule") {
      const when = body.scheduledAt ? new Date(body.scheduledAt) : null;
      if (!when || Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) {
        return NextResponse.json({ error: "Choose a valid future date and time." }, { status: 400 });
      }
      const article = await scheduleArticle(params.id, when);
      await logActivity(session, "article_scheduled", { type: "article", id: article.id, label: article.title }, { scheduledAt: when.toISOString() });
      return NextResponse.json({ ok: true, article });
    }

    if (action === "cancel_schedule") {
      const article = await cancelSchedule(params.id);
      await logActivity(session, "article_schedule_cancelled", { type: "article", id: article.id, label: article.title });
      return NextResponse.json({ ok: true, article });
    }

    if (action === "unpublish") {
      const article = await unpublishArticle(params.id);
      await logActivity(session, "article_unpublished", { type: "article", id: article.id, label: article.title });
      if (author) await notifyArticleUnpublished({ id: author.id, email: author.email }, { id: article.id, title: article.title });
      return NextResponse.json({ ok: true, article });
    }

    if (action === "editorial_flags") {
      const article = await updateEditorialFlags(params.id, {
        featured: body.featured !== undefined ? Boolean(body.featured) : undefined,
        trending: body.trending !== undefined ? Boolean(body.trending) : undefined,
        editorsPick: body.editorsPick !== undefined ? Boolean(body.editorsPick) : undefined,
        breaking: body.breaking !== undefined ? Boolean(body.breaking) : undefined,
      });
      await logActivity(session, "article_editorial_flags_updated", { type: "article", id: article.id, label: article.title }, {
        featured: article.featured,
        trending: article.trending,
        editorsPick: article.editorsPick,
        breaking: article.breaking,
      });
      return NextResponse.json({ ok: true, article });
    }

    if (action === "restore_revision") {
      const revisionId = Number(body.revisionId);
      const revision = await getRevisionById(revisionId);
      if (!revision || revision.articleId !== params.id) {
        return NextResponse.json({ error: "Revision not found." }, { status: 404 });
      }
      const article = await adminUpdateArticle(params.id, {
        title: revision.title,
        excerpt: revision.excerpt,
        contentHtml: revision.contentHtml,
        image: revision.image,
        imageAlt: revision.imageAlt,
      });
      await recordRevision({
        articleId: article.id,
        editorId: session.userId,
        editorEmail: session.email,
        editorRole: "admin",
        title: article.title,
        excerpt: article.excerpt,
        contentHtml: article.contentHtml,
        image: article.image,
        imageAlt: article.imageAlt,
        changeSummary: `Restored from revision #${revision.id} (${new Date(revision.createdAt).toLocaleString()})`,
      });
      await logActivity(session, "article_revision_restored", { type: "article", id: article.id, label: article.title }, { revisionId });
      return NextResponse.json({ ok: true, article });
    }

    if (action === "edit") {
      const article = await adminUpdateArticle(params.id, {
        title: body.title !== undefined ? body.title : undefined,
        excerpt: body.excerpt !== undefined ? body.excerpt : undefined,
        contentHtml: body.contentHtml !== undefined ? body.contentHtml : undefined,
        cityId: body.cityId !== undefined ? body.cityId : undefined,
        categoryId: body.categoryId !== undefined ? body.categoryId : undefined,
        attractionId: body.attractionId !== undefined ? body.attractionId : undefined,
        image: body.image !== undefined ? body.image : undefined,
        imageAlt: body.imageAlt !== undefined ? body.imageAlt : undefined,
        metaTitle: body.metaTitle !== undefined ? body.metaTitle : undefined,
        metaDescription: body.metaDescription !== undefined ? body.metaDescription : undefined,
        focusKeyword: body.focusKeyword !== undefined ? body.focusKeyword : undefined,
        tags: body.tags !== undefined ? body.tags : undefined,
        canonicalUrl: body.canonicalUrl !== undefined ? body.canonicalUrl : undefined,
        slug: body.slug !== undefined ? body.slug : undefined,
      });
      await recordRevision({
        articleId: article.id,
        editorId: session.userId,
        editorEmail: session.email,
        editorRole: "admin",
        title: article.title,
        excerpt: article.excerpt,
        contentHtml: article.contentHtml,
        image: article.image,
        imageAlt: article.imageAlt,
        changeSummary: "Edited by admin",
      });
      await logActivity(session, "article_edited", { type: "article", id: article.id, label: article.title });
      return NextResponse.json({ ok: true, article });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (
      message.includes("already used by another article") ||
      message.includes("can't be empty") ||
      message.includes("can't be published") ||
      message.includes("can be scheduled") ||
      message.includes("currently scheduled") ||
      message.includes("isn't currently scheduled") ||
      message.includes("isn't awaiting review")
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const before = await getArticleById(params.id).catch(() => undefined);
  try {
    await deleteArticle(params.id);
    if (before) {
      await logActivity(session, "article_deleted", { type: "article", id: params.id, label: before.title });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}
