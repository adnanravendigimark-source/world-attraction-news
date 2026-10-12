import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { requireApiPermission } from "@/lib/permissions";
import { blogPanelData, regenerateSection } from "@/lib/blogs/writer";
import { checkAndRevise } from "@/lib/news/factcheck";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// GET ?articleId= -> the editor's Blog panel (outline, research summary).
export async function GET(req: Request) {
  const session = await getSession();
  const denied = await requireApiPermission(session, "articles", "update");
  if (denied) return denied;
  const articleId = new URL(req.url).searchParams.get("articleId") || "";
  return NextResponse.json({ blog: articleId ? await blogPanelData(articleId) : null });
}

// { articleId, action: "regenerate", index } -> rewrites one section, then re-checks facts.
export async function POST(req: Request) {
  const session = await getSession();
  const denied = await requireApiPermission(session, "articles", "update");
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  try {
    if (body?.action !== "regenerate") return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    const articleId = String(body.articleId || "");
    const r = await regenerateSection(articleId, Number(body.index));
    const c = await checkAndRevise(articleId);
    return NextResponse.json({ ok: true, words: r.words, verdict: c.check.verdict });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err).slice(0, 300) }, { status: 400 });
  }
}
