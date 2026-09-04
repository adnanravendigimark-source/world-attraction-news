import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getSubscribers } from "@/lib/newsletter";
import { dbErrorMessage } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const subscribers = await getSubscribers();
    return NextResponse.json({ subscribers });
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}
