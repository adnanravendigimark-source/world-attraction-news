import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getAllEvents, createEvent, type EventType } from "@/lib/events";
import { logActivity } from "@/lib/activity";
import { dbErrorMessage } from "@/lib/db";

export const dynamic = "force-dynamic";

const VALID_TYPES: EventType[] = ["festival", "opening", "exhibition", "special", "celebration"];

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const events = await getAllEvents();
    return NextResponse.json({ events });
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
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
  const title = (body.title || "").trim();
  const eventDate = (body.eventDate || "").trim();
  if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 });
  if (!eventDate) return NextResponse.json({ error: "Event date is required." }, { status: 400 });
  const eventType: EventType = VALID_TYPES.includes(body.eventType) ? body.eventType : "special";

  try {
    const event = await createEvent({
      title,
      description: body.description || "",
      eventDate,
      endDate: body.endDate || null,
      location: body.location || "",
      cityId: body.cityId || null,
      eventType,
      image: body.image || "",
      imageAlt: body.imageAlt || "",
      articleId: body.articleId || null,
    });
    await logActivity(session, "event_created", { type: "event", id: event.id, label: event.title });
    return NextResponse.json({ ok: true, event });
  } catch (err) {
    const message = err instanceof Error ? err.message : dbErrorMessage(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
