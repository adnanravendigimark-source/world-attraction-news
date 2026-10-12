import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { requireApiPermission } from "@/lib/permissions";
import { loadHealth } from "@/lib/news/ops";
import { loadAutomation } from "@/lib/news/jobs";

export const dynamic = "force-dynamic";

// GET → health checks for the news pipeline (Phase 14).
export async function GET() {
  const session = await getSession();
  const denied = await requireApiPermission(session, "news", "read");
  if (denied) return denied;
  const cfg = await loadAutomation();
  return NextResponse.json({ checks: await loadHealth(cfg.dailyCostCapUsd) });
}
