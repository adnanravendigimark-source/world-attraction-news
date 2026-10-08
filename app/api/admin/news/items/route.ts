import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { dbErrorMessage } from "@/lib/db";
import { requireApiPermission } from "@/lib/permissions";
import { listNewsItems, setNewsItemStatus } from "@/lib/news/items";

export const dynamic = "force-dynamic";

const STATUSES = ["new", "dismissed", "shortlisted"];

export async function GET(req: Request) {
  const session = await getSession();
  const denied = await requireApiPermission(session, "news", "read");
  if (denied) return denied;
  const sp = new URL(req.url).searchParams;
  try {
    const result = await listNewsItems({
      q: sp.get("q") || "",
      sourceId: sp.get("sourceId") || "",
      category: sp.get("category") || "",
      status: sp.get("status") || "",
      relevance: sp.get("relevance") ?? "",
      limit: Number(sp.get("limit")) || 50,
      offset: Number(sp.get("offset")) || 0,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}

// Triage a raw item: { id, status: "new" | "dismissed" | "shortlisted" }
export async function PATCH(req: Request) {
  const session = await getSession();
  const denied = await requireApiPermission(session, "news", "update");
  if (denied) return denied;
  try {
    const body = await req.json();
    if (!body?.id || !STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    await setNewsItemStatus(String(body.id), body.status);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}
