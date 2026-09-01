import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { markNotificationRead } from "@/lib/notifications";
import { dbErrorMessage } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PATCH(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "Invalid notification." }, { status: 400 });
  try {
    await markNotificationRead(id, session.userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}
