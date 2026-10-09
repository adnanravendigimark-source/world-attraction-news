import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { dbErrorMessage, sql } from "@/lib/db";
import { requireApiPermission } from "@/lib/permissions";
import { getImageMeta, saveImageMeta, listCandidates, importCandidate, recropCover } from "@/lib/news/images";
import { ensureImages, generateCoverImage } from "@/lib/news/imagegen";

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
    const [meta, candidates, rows] = await Promise.all([
      getImageMeta(articleId),
      listCandidates(articleId),
      sql`SELECT image FROM articles WHERE id = ${articleId} LIMIT 1`,
    ]);
    return NextResponse.json({ meta, candidates, image: rows[0]?.image || "" });
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}

// PUT { articleId, sourceType, credit, license, sourceUrl } → save provenance
// POST { articleId, imageUrl } → import a candidate as the cover
export async function PUT(req: Request) {
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

export async function POST(req: Request) {
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
