import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getEventById, updateEvent, deleteEvent, type EventType } from "@/lib/events";
import { getCityById } from "@/lib/cities";
import { logActivity } from "@/lib/activity";
import { dbErrorMessage } from "@/lib/db";

export const dynamic = "force-dynamic";

const VALID_TYPES: EventType[] = ["festival", "opening", "exhibition", "special", "celebration"];

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const current = await getEventById(params.id).catch(() => undefined);
  if (!current) return NextResponse.json({ error: "Event not found." }, { status: 404 });

  const nextEventDate = body.eventDate !== undefined ? String(body.eventDate).trim() : current.eventDate;
  const nextEndDate = body.endDate !== undefined ? (body.endDate ? String(body.endDate).trim() : null) : current.endDate;
  if (nextEndDate && nextEndDate < nextEventDate) {
    return NextResponse.json({ error: "End date can't be before the start date." }, { status: 400 });
  }

  if (body.cityId !== undefined && body.cityId) {
    const city = await getCityById(String(body.cityId).trim()).catch(() => undefined);
    if (!city) return NextResponse.json({ error: "That city doesn't exist." }, { status: 400 });
  }

  try {
    const event = await updateEvent(params.id, {
      title: body.title !== undefined ? body.title : undefined,
      description: body.description !== undefined ? body.description : undefined,
      eventDate: body.eventDate !== undefined ? body.eventDate : undefined,
      endDate: body.endDate !== undefined ? body.endDate || null : undefined,
      location: body.location !== undefined ? body.location : undefined,
      cityId: body.cityId !== undefined ? body.cityId || null : undefined,
      eventType: body.eventType !== undefined && VALID_TYPES.includes(body.eventType) ? body.eventType : undefined,
      image: body.image !== undefined ? body.image : undefined,
      imageAlt: body.imageAlt !== undefined ? body.imageAlt : undefined,
      articleId: body.articleId !== undefined ? body.articleId || null : undefined,
    });
    await logActivity(session, "event_edited", { type: "event", id: event.id, label: event.title });
    return NextResponse.json({ ok: true, event });
  } catch (err) {
    const message = err instanceof Error ? err.message : dbErrorMessage(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const before = await getEventById(params.id).catch(() => undefined);
  try {
    await deleteEvent(params.id);
    if (before) await logActivity(session, "event_deleted", { type: "event", id: params.id, label: before.title });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : dbErrorMessage(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
