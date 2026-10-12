import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { requireApiPermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { finishStep, outlineStep, sectionStep } from "@/lib/blogs/writer";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// One step per request (one model call each):
// { topicId, step: "outline" } | { topicId, step: "section", index } | { topicId, step: "finish" }
export async function POST(req: Request) {
  const session = await getSession();
  const denied = await requireApiPermission(session, "news", "update");
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  const topicId = String(body?.topicId || "");
  try {
    if (body?.step === "outline") return NextResponse.json({ outline: await outlineStep(topicId) });
    if (body?.step === "section") return NextResponse.json(await sectionStep(topicId, Number(body.index)));
    if (body?.step === "finish") {
      const r = await finishStep(topicId);
      if (session) await logActivity(session, "blog_drafted", { type: "article", id: r.articleId, label: `AI blog draft (${r.wordCount} words)` });
      return NextResponse.json(r);
    }
    return NextResponse.json({ error: "Unknown step." }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err).slice(0, 300) }, { status: 400 });
  }
}
