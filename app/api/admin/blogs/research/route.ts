import { withSiteRevalidate } from "@/lib/revalidateSite";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { requireApiPermission } from "@/lib/permissions";
import { getLatestBlogResearch, runBlogResearch } from "@/lib/blogs/research";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: Request) {
  const session = await getSession();
  const denied = await requireApiPermission(session, "news", "read");
  if (denied) return denied;
  const topicId = new URL(req.url).searchParams.get("topicId") || "";
  return NextResponse.json({ research: topicId ? await getLatestBlogResearch(topicId) : null });
}

// { topicId, urls?: string[] } -> runs research (one AI call).
async function POSTHandler(req: Request) {
  const session = await getSession();
  const denied = await requireApiPermission(session, "news", "update");
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  try {
    const urls = Array.isArray(body?.urls) ? body.urls.map(String).slice(0, 5) : [];
    return NextResponse.json({ research: await runBlogResearch(String(body?.topicId || ""), { urls }) });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err).slice(0, 300) }, { status: 400 });
  }
}

export const POST = withSiteRevalidate(POSTHandler);
