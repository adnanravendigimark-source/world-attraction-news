import { withSiteRevalidate } from "@/lib/revalidateSite";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { requireApiPermission } from "@/lib/permissions";
import { suggestTopics } from "@/lib/blogs/topics";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// { destination?: "Florence", topic?: "arno boat tour" } -> topic ideas, saved
// as "suggested". With a topic, the ideas are about that topic and the
// destination may be left out (the model names it; we check it). One AI call.
async function POSTHandler(req: Request) {
  const session = await getSession();
  const denied = await requireApiPermission(session, "news", "update");
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  try {
    return NextResponse.json({ ok: true, topics: await suggestTopics(String(body?.destination || "").slice(0, 80), session?.email || "", String(body?.topic || "").slice(0, 120)) });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err).slice(0, 300) }, { status: 400 });
  }
}

export const POST = withSiteRevalidate(POSTHandler);
