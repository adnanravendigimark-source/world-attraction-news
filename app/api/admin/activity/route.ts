import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getActivityLog } from "@/lib/activity";
import { requireApiPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  const denied = await requireApiPermission(session, "activity", "read");
  if (denied) return denied;
  const entries = await getActivityLog();
  return NextResponse.json({ entries });
}
