import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getArticlesByAuthor, createDraft } from "@/lib/articles";
import { getCityById } from "@/lib/cities";
import { dbErrorMessage } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const articles = await getArticlesByAuthor(session.userId);
    return NextResponse.json({ articles });
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}

// Creates a new DRAFT — the first save of the "Write New Article" flow
// (see components/dashboard/ArticleEditor.tsx). This does NOT submit
// anything for review; that only happens via the explicit
// /api/dashboard/articles/[id]/submit call once the contributor is ready.
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const title = (body.title || "").trim();
  const cityId = (body.cityId || "").trim();
  const categoryId = body.categoryId || null;

  if (!cityId) {
    return NextResponse.json({ error: "Select which city this article belongs to." }, { status: 400 });
  }
  const city = await getCityById(cityId).catch(() => undefined);
  if (!city) {
    return NextResponse.json({ error: "Select a valid city from the list." }, { status: 400 });
  }

  try {
    // The ArticleEditor's very first autosave already carries everything
    // the contributor has entered so far (see the comment on createDraft in
    // lib/articles.ts) — forward all of it here rather than persisting only
    // title/city and waiting for a second round trip to save the rest.
    const article = await createDraft({
      title,
      cityId,
      categoryId,
      attractionId: body.attractionId ?? null,
      authorId: session.userId,
      excerpt: body.excerpt !== undefined ? String(body.excerpt).trim() : undefined,
      contentHtml: body.contentHtml !== undefined ? String(body.contentHtml) : undefined,
      image: body.image || undefined,
      imageAlt: body.imageAlt !== undefined ? String(body.imageAlt) : undefined,
      metaTitle: body.metaTitle !== undefined ? String(body.metaTitle) : undefined,
      metaDescription: body.metaDescription !== undefined ? String(body.metaDescription) : undefined,
      focusKeyword: body.focusKeyword !== undefined ? String(body.focusKeyword) : undefined,
    });
    return NextResponse.json({ ok: true, article });
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}
