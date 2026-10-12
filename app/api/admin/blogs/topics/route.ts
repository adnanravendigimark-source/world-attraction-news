import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { requireApiPermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { createTopic, listTopics, setTopicStatus } from "@/lib/blogs/topics";
import { blogsWrittenToday, loadBlogSettings, planCoreGuides, refreshBlog, saveBlogSettings, setAuto } from "@/lib/blogs/automation";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  const denied = await requireApiPermission(session, "news", "read");
  if (denied) return denied;
  try {
    const [topics, settings, today] = await Promise.all([listTopics(), loadBlogSettings(), blogsWrittenToday()]);
    return NextResponse.json({ topics, settings, today });
  } catch (err: any) {
    return NextResponse.json({ error: "Could not load topics. Run node scripts/setup-db.mjs if this is a new install." }, { status: 500 });
  }
}

// { action: "create", title, destination, angle?, topicType?, targetWords? }
// { action: "status", ids: string[], status: "queued" | "dismissed" }
export async function POST(req: Request) {
  const session = await getSession();
  const denied = await requireApiPermission(session, "news", "update");
  if (denied) return denied;
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  try {
    // B7: core guides, background writing, refresh check, settings.
    if (body?.action === "core") {
      return NextResponse.json({ ok: true, ...(await planCoreGuides(String(body.destination || ""), !!body.auto, session.email)) });
    }
    if (body?.action === "auto") {
      const ids = Array.isArray(body.ids) ? body.ids.map(String).slice(0, 50) : [];
      return NextResponse.json({ ok: true, updated: await setAuto(ids, body.on !== false) });
    }
    if (body?.action === "refresh") {
      return NextResponse.json({ ok: true, ...(await refreshBlog(String(body.id || ""))) });
    }
    if (body?.action === "settings") {
      return NextResponse.json({ ok: true, settings: await saveBlogSettings(body.settings || {}) });
    }
    if (body?.action === "status") {
      const ids = Array.isArray(body.ids) ? body.ids.map(String).slice(0, 100) : [];
      const status = body.status === "dismissed" ? "dismissed" : "queued";
      return NextResponse.json({ ok: true, updated: await setTopicStatus(ids, status) });
    }
    const topic = await createTopic({ ...body, createdBy: session.email });
    await logActivity(session, "blog_topic_created", { type: "blog_topic", id: topic.id, label: topic.title });
    return NextResponse.json({ ok: true, topic });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err).slice(0, 300) }, { status: 400 });
  }
}
