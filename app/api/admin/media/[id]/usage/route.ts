import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getMediaItemById, getMediaUsage } from "@/lib/media";
import { dbErrorMessage } from "@/lib/db";

export const dynamic = "force-dynamic";

// Lets the Media Library UI show "where is this used" on demand for any
// item, not just as a delete-blocking warning — a real query against the
// current database state, not a cached or guessed answer.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "Invalid media id." }, { status: 400 });

  try {
    const item = await getMediaItemById(id);
    if (!item) return NextResponse.json({ error: "Media item not found." }, { status: 404 });
    const usage = await getMediaUsage(item.url);
    return NextResponse.json({ usage });
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}
