import { withSiteRevalidate } from "@/lib/revalidateSite";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { dbErrorMessage, sql } from "@/lib/db";
import { requireApiPermission } from "@/lib/permissions";
import { getImageMeta, saveImageMeta, listCandidates, importCandidate, recropCover } from "@/lib/news/images";
import { ensureImages, generateCoverImage, previewImages } from "@/lib/news/imagegen";
import { generateInlineImage, inlineSlots, removeInlineImage } from "@/lib/news/inlineImages";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // AI steps; see lib/news/jobs.ts

// GET ?articleId= → { meta, candidates }
export async function GET(req: Request) {
  const session = await getSession();
  const denied = await requireApiPermission(session, "articles", "update");
  if (denied) return denied;
  const articleId = new URL(req.url).searchParams.get("articleId") || "";
  if (!articleId) return NextResponse.json({ error: "articleId is required." }, { status: 400 });
  try {
    const [meta, candidates, rows, slots] = await Promise.all([
      getImageMeta(articleId),
      listCandidates(articleId),
      sql`SELECT image FROM articles WHERE id = ${articleId} LIMIT 1`,
      inlineSlots(articleId).catch(() => []),
    ]);
    return NextResponse.json({ meta, candidates, image: rows[0]?.image || "", slots });
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}

// PUT { articleId, sourceType, credit, license, sourceUrl } → save provenance
// POST { articleId, imageUrl } → import a candidate as the cover
async function PUTHandler(req: Request) {
  const session = await getSession();
  const denied = await requireApiPermission(session, "articles", "update");
  if (denied) return denied;
  const body = await req.json().catch(() => null);
  if (!body?.articleId) return NextResponse.json({ error: "articleId is required." }, { status: 400 });
  try {
    const meta = await saveImageMeta(String(body.articleId), {
      sourceType: body.sourceType,
      credit: typeof body.credit === "string" ? body.credit : undefined,
      license: typeof body.license === "string" ? body.license : undefined,
      sourceUrl: typeof body.sourceUrl === "string" ? body.sourceUrl : undefined,
    });
    return NextResponse.json({ ok: true, meta });
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}

async function POSTHandler(req: Request) {
  const session = await getSession();
  const denied = await requireApiPermission(session, "articles", "update");
  if (denied) return denied;
  const body = await req.json().catch(() => null);
  if (body?.articleId && body?.auto) {
    try {
      const result = await ensureImages(String(body.articleId), {
        allowAi: body.allowAi !== false,
        inline: typeof body.inline === "boolean" ? body.inline : undefined,
      });
      return NextResponse.json({ ok: true, ...result });
    } catch (err: any) {
      console.error("[news/images] auto failed:", err);
      return NextResponse.json({ error: err?.message || "Photo search failed." }, { status: 400 });
    }
  }
  // { articleId, inline: { action: "generate" | "remove", index, direction? } }
  // → an AI image inside the article at one spot (see lib/news/inlineImages.ts)
  if (body?.articleId && body?.inline && typeof body.inline === "object") {
    const index = Number(body.inline.index);
    if (!Number.isInteger(index) || index < 0 || index > 200) return NextResponse.json({ error: "Choose a spot in the article." }, { status: 400 });
    try {
      if (body.inline.action === "remove") return NextResponse.json({ ok: true, slots: await removeInlineImage(String(body.articleId), index) });
      if (body.inline.action === "generate") {
        const direction = typeof body.inline.direction === "string" ? body.inline.direction.slice(0, 300) : "";
        return NextResponse.json({ ok: true, ...(await generateInlineImage(String(body.articleId), index, direction)) });
      }
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    } catch (err: any) {
      console.error("[news/images] inline failed:", err);
      return NextResponse.json({ error: err?.message || "Image generation failed." }, { status: 400 });
    }
  }
  // { articleId, preview: true } → which photo would be chosen and the AI
  // prompt, without changing anything (photo searches only, no AI call)
  if (body?.articleId && body?.preview) {
    try {
      return NextResponse.json({ ok: true, ...(await previewImages(String(body.articleId))) });
    } catch (err: any) {
      return NextResponse.json({ error: err?.message || "Preview failed." }, { status: 400 });
    }
  }
  // { articleId, recrop: true } → crop the current cover to 1200×675
  if (body?.articleId && body?.recrop) {
    try {
      const result = await recropCover(String(body.articleId));
      return NextResponse.json({ ok: true, ...result });
    } catch (err: any) {
      return NextResponse.json({ error: err?.message || "Cropping failed." }, { status: 400 });
    }
  }
  if (body?.articleId && body?.generate) {
    try {
      const result = await generateCoverImage(String(body.articleId), typeof body.direction === "string" ? body.direction : "");
      return NextResponse.json({ ok: true, ...result });
    } catch (err: any) {
      console.error("[news/images] generate failed:", err);
      return NextResponse.json({ error: err?.message || "Image generation failed." }, { status: 400 });
    }
  }
  if (!body?.articleId || !body?.imageUrl) return NextResponse.json({ error: "articleId and imageUrl are required." }, { status: 400 });
  try {
    const result = await importCandidate(String(body.articleId), String(body.imageUrl));
    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || dbErrorMessage(err) }, { status: 400 });
  }
}

export const POST = withSiteRevalidate(POSTHandler);
export const PUT = withSiteRevalidate(PUTHandler);
