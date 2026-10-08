import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { dbErrorMessage } from "@/lib/db";
import { requireApiPermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { createDraftFromStory } from "@/lib/news/drafts";

export const dynamic = "force-dynamic";

// Body: { clusterId }. Creates (or returns the existing) news draft for a story.
export async function POST(req: Request) {
  const session = await getSession();
  const denied = await requireApiPermission(session, "articles", "create");
  if (denied) return denied;
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const clusterId = String(body?.clusterId || "");
  if (!clusterId) return NextResponse.json({ error: "clusterId is required." }, { status: 400 });
  try {
    const { article, created } = await createDraftFromStory(clusterId);
    if (created) await logActivity(session, "news_draft_created", { type: "article", id: article.id, label: article.title });
    return NextResponse.json({ ok: true, created, articleId: article.id, adminUrl: `/admin/articles/${article.id}` });
  } catch (err: any) {
    console.error("[api/admin/news/drafts] error:", err);
    const detail = process.env.NODE_ENV !== "production" && err instanceof Error ? err.message : undefined;
    const known = typeof err?.message === "string" && (err.message.startsWith("Story not found") || err.message.includes("author is missing"));
    return NextResponse.json({ error: known ? err.message : dbErrorMessage(err), detail }, { status: known ? 400 : 500 });
  }
}
