import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  getArticleById,
  reviewArticle,
  publishArticle,
  unpublishArticle,
  adminUpdateArticle,
  deleteArticle,
} from "@/lib/articles";
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
// body.action — keeps the review-score-feedback flow, publish/unpublish
// toggle, and general content edits all under one route.
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

  try {
    if (action === "review") {
      if (before.status === "published") {
        return NextResponse.json(
          { error: "This article is already published. Unpublish it first to change its review status." },
          { status: 400 }
        );
      }
      const status = body.status === "approved" || body.status === "rejected" ? body.status : null;
      if (!status) return NextResponse.json({ error: "Choose Approve or Reject." }, { status: 400 });
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
      await logActivity(
        session,
        status === "approved" ? "article_approved" : "article_rejected",
        { type: "article", id: article.id, label: article.title },
        { score, hasFeedback: Boolean(feedback) }
      );
      if (score !== null) {
        await logActivity(session, "article_scored", { type: "article", id: article.id, label: article.title }, { score });
      }
      return NextResponse.json({ ok: true, article });
    }

    if (action === "publish") {
      const article = await publishArticle(params.id);
      await logActivity(session, "article_published", { type: "article", id: article.id, label: article.title });
      return NextResponse.json({ ok: true, article });
    }

    if (action === "unpublish") {
      const article = await unpublishArticle(params.id);
      await logActivity(session, "article_unpublished", { type: "article", id: article.id, label: article.title });
      return NextResponse.json({ ok: true, article });
    }

    if (action === "edit") {
      const article = await adminUpdateArticle(params.id, {
        title: body.title !== undefined ? body.title : undefined,
        excerpt: body.excerpt !== undefined ? body.excerpt : undefined,
        contentHtml: body.contentHtml !== undefined ? body.contentHtml : undefined,
        cityId: body.cityId !== undefined ? body.cityId : undefined,
        categoryId: body.categoryId !== undefined ? body.categoryId : undefined,
        image: body.image !== undefined ? body.image : undefined,
        imageAlt: body.imageAlt !== undefined ? body.imageAlt : undefined,
        metaTitle: body.metaTitle !== undefined ? body.metaTitle : undefined,
        metaDescription: body.metaDescription !== undefined ? body.metaDescription : undefined,
        focusKeyword: body.focusKeyword !== undefined ? body.focusKeyword : undefined,
        tags: body.tags !== undefined ? body.tags : undefined,
        canonicalUrl: body.canonicalUrl !== undefined ? body.canonicalUrl : undefined,
        slug: body.slug !== undefined ? body.slug : undefined,
      });
      await logActivity(session, "article_edited", { type: "article", id: article.id, label: article.title });
      return NextResponse.json({ ok: true, article });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message.includes("already used by another article") || message.includes("can't be empty")) {
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
