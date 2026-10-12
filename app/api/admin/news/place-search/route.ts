import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { dbErrorMessage } from "@/lib/db";
import { requireApiPermission } from "@/lib/permissions";
import { searchPlaceNews } from "@/lib/news/placeSearch";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Body: { place: "Barcelona" }. Fetches fresh news for the place (last 7 days).
export async function POST(req: Request) {
  const session = await getSession();
  const denied = await requireApiPermission(session, "news", "update");
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  const place = String(body?.place || "").trim().slice(0, 80);
  if (!place) return NextResponse.json({ error: "Type a city or country." }, { status: 400 });
  try {
    return NextResponse.json(await searchPlaceNews(place));
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ? String(err.message) : dbErrorMessage(err) }, { status: 500 });
  }
}
