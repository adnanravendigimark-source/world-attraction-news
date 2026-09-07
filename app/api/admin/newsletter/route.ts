import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getSubscribers } from "@/lib/newsletter";
import { dbErrorMessage } from "@/lib/db";
import { requireApiPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  const denied = await requireApiPermission(session, "subscribers", "read");
  if (denied) return denied;

  try {
    const subscribers = await getSubscribers();
    return NextResponse.json({ subscribers });
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}
