import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { requireApiPermission } from "@/lib/permissions";
import { suggestTopics } from "@/lib/blogs/topics";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// { destination: "Florence" } -> 10 topic ideas, saved as "suggested". One AI call.
export async function POST(req: Request) {
  const session = await getSession();
  const denied = await requireApiPermission(session, "news", "update");
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  try {
    return NextResponse.json({ ok: true, topics: await suggestTopics(String(body?.destination || ""), session?.email || "") });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err).slice(0, 300) }, { status: 400 });
  }
}
