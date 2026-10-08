import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { dbErrorMessage } from "@/lib/db";
import { requireApiPermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { deleteNewsSource, getNewsSource, setNewsSourceActive, updateNewsSource, validateNewsSourceInput } from "@/lib/news/sources";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  const denied = await requireApiPermission(session, "news", "update");
  if (denied) return denied;
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  try {
    const existing = await getNewsSource(params.id);
    if (!existing) return NextResponse.json({ error: "Source not found." }, { status: 404 });
    // Toggle-only update.
    if (Object.keys(body).length === 1 && typeof body.isActive === "boolean") {
      await setNewsSourceActive(params.id, body.isActive);
      await logActivity(session, body.isActive ? "news_source_enabled" : "news_source_disabled", {
        type: "news_source",
        id: existing.id,
        label: existing.name,
      });
      return NextResponse.json({ ok: true });
    }
    const merged = { ...existing, ...body };
    const invalid = validateNewsSourceInput(merged);
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });
    const source = await updateNewsSource(params.id, merged);
    await logActivity(session, "news_source_updated", { type: "news_source", id: existing.id, label: existing.name });
    return NextResponse.json({ ok: true, source });
  } catch (err: any) {
    if (String(err?.message || "").includes("news_sources_feed_uniq")) {
      return NextResponse.json({ error: "A source with that feed URL already exists." }, { status: 409 });
    }
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  const denied = await requireApiPermission(session, "news", "delete");
  if (denied) return denied;
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  try {
    const existing = await getNewsSource(params.id);
    if (!existing) return NextResponse.json({ error: "Source not found." }, { status: 404 });
    await deleteNewsSource(params.id);
    await logActivity(session, "news_source_deleted", { type: "news_source", id: existing.id, label: existing.name });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}
