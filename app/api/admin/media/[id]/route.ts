import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { updateMediaMeta, deleteMediaItem, getMediaUsage, getMediaLibrary } from "@/lib/media";
import { logActivity } from "@/lib/activity";
import { dbErrorMessage } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "Invalid media id." }, { status: 400 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  try {
    const item = await updateMediaMeta(id, { altText: body.altText, caption: body.caption });
    return NextResponse.json({ ok: true, item });
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}

// Deletes an image entirely — from Blob storage and the media_library
// index. Refuses if the image is still referenced by a city hero or
// article cover (an admin can pass `force: true` to delete anyway, which
// will break that reference — the response's `usage` field is what the UI
// shows to warn about that before letting them confirm).
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "Invalid media id." }, { status: 400 });

  let force = false;
  try {
    const body = await req.json();
    force = Boolean(body?.force);
  } catch {
    // no body — force stays false
  }

  const items = await getMediaLibrary();
  const item = items.find((m) => m.id === id);
  if (!item) return NextResponse.json({ error: "Media item not found." }, { status: 404 });

  const usage = await getMediaUsage(item.url);
  const isUsed = usage.cityHero.length > 0 || usage.articleCover.length > 0 || usage.articleContent.length > 0;
  if (isUsed && !force) {
    return NextResponse.json({ error: "This image is still in use.", usage, needsConfirmation: true }, { status: 409 });
  }

  try {
    await deleteMediaItem(id);
    await logActivity(session, "media_deleted", { type: "media", id: String(id), label: item.filename }, { wasUsed: isUsed });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}
