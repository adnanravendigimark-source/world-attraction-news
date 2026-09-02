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

  // avatarUrl is only ever set here to a URL our own upload route just
  // returned (or "" to remove it) — see components/dashboard/AvatarUploadField.tsx.
  // Never accepted as an arbitrary pasted URL, same rule as every other
  // image field in this app.
  const avatarUrl = body.avatarUrl !== undefined ? String(body.avatarUrl) : undefined;

  try {
    const user = await updateOwnProfile(session.userId, { displayName, bio, avatarUrl });
    return NextResponse.json({ ok: true, user });
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}
