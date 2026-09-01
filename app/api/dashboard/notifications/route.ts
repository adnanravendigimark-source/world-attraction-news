import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getNotifications, getUnreadCount, markAllNotificationsRead } from "@/lib/notifications";
import { dbErrorMessage } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const [notifications, unreadCount] = await Promise.all([
      getNotifications(session.userId),
      getUnreadCount(session.userId),
    ]);
    return NextResponse.json({ notifications, unreadCount });
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}

// Marks every unread notification for the logged-in user as read.
export async function PATCH() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await markAllNotificationsRead(session.userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}
