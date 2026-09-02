import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getArticleById, updateOwnArticle, updateDraft, deleteOwnDraft } from "@/lib/articles";
import { getCityById } from "@/lib/cities";
import { dbErrorMessage } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const article = await getArticleById(params.id).catch(() => undefined);
  if (!article || article.authorId !== session.userId) {
    return NextResponse.json({ error: "Article not found." }, { status: 404 });
  }
  return NextResponse.json({ article });
}

// Handles both the autosave path (status = 'draft', no forced status
// change) and the legacy "edit a rejected/pending article" path (which
// resubmits it — see updateOwnArticle). Which one runs is decided by the
// article's *current* status in the database, never anything the client
// claims.
//
// Exported as PATCH (not PUT) because that's the only method
// components/dashboard/ArticleEditor.tsx's autosave/manual-save actually
// sends — a PUT-only handler here means every save silently 405s.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const article = await getArticleById(params.id).catch(() => undefined);
  if (!article || article.authorId !== session.userId) {
    return NextResponse.json({ error: "Article not found." }, { status: 404 });
  }
  if (article.status !== "pending" && article.status !== "rejected" && article.status !== "draft") {
    return NextResponse.json(
      { error: "This article can no longer be edited (it has already been approved or published)." },
      { status: 409 }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const title = body.title !== undefined ? String(body.title).trim() : undefined;
  const excerpt = body.excerpt !== undefined ? String(body.excerpt).trim() : undefined;
  const contentHtml = body.contentHtml !== undefined ? String(body.contentHtml) : undefined;

  // A draft can be saved with a short/incomplete title or body (that's the
  // whole point of autosaving a work in progress) — only a resubmit of a
  // pending/rejected article enforces the full publish-quality minimums,
  // matching the original behavior of this endpoint.
  if (article.status !== "draft") {
    if (title !== undefined && title && title.length < 8) {
      return NextResponse.json({ error: "Title must be at least 8 characters." }, { status: 400 });
    }
    if (contentHtml !== undefined && contentHtml && contentHtml.replace(/<[^>]*>/g, "").trim().length < 200) {
      return NextResponse.json(
        { error: "Article body must contain at least 200 characters of actual written content." },
        { status: 400 }
      );
    }
  }

  let cityId: string | undefined;
  if (body.cityId !== undefined) {
    const trimmedCityId: string = String(body.cityId || "").trim();
    const city = await getCityById(trimmedCityId).catch(() => undefined);
    if (!city) {
      return NextResponse.json({ error: "Select a valid city from the list." }, { status: 400 });
    }
    cityId = trimmedCityId;
  }

  const updates = {
    title: title || undefined,
    excerpt: excerpt || undefined,
    contentHtml: contentHtml || undefined,
    cityId,
    categoryId: body.categoryId !== undefined ? body.categoryId : undefined,
    attractionId: body.attractionId !== undefined ? body.attractionId : undefined,
    image: body.image || undefined,
    imageAlt: body.imageAlt !== undefined ? body.imageAlt : undefined,
    metaTitle: body.metaTitle !== undefined ? body.metaTitle : undefined,
    metaDescription: body.metaDescription !== undefined ? body.metaDescription : undefined,
    focusKeyword: body.focusKeyword !== undefined ? body.focusKeyword : undefined,
  };

  try {
    const updated = article.status === "draft" ? await updateDraft(params.id, updates) : await updateOwnArticle(params.id, updates);
    return NextResponse.json({ ok: true, article: updated });
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}

// A contributor discarding their own never-submitted draft.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const article = await getArticleById(params.id).catch(() => undefined);
  if (!article || article.authorId !== session.userId) {
    return NextResponse.json({ error: "Article not found." }, { status: 404 });
  }
  if (article.status !== "draft") {
    return NextResponse.json({ error: "Only an unsubmitted draft can be discarded." }, { status: 409 });
  }

  try {
    await deleteOwnDraft(params.id, session.userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}
