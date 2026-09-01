import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getMediaLibrary } from "@/lib/media";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const items = await getMediaLibrary();
  return NextResponse.json({ items });
}
