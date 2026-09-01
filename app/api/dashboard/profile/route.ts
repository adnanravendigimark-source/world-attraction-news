import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { updateOwnProfile } from "@/lib/users";
import { dbErrorMessage } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const displayName = (body.displayName || "").trim();
  const bio = (body.bio || "").trim();
  if (!displayName) return NextResponse.json({ error: "Enter your name." }, { status: 400 });

  try {
    const user = await updateOwnProfile(session.userId, { displayName, bio });
    return NextResponse.json({ ok: true, user });
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}
