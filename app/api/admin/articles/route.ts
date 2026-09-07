import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getAllArticles, type ArticleStatus } from "@/lib/articles";
import { dbErrorMessage } from "@/lib/db";
import { requireApiPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getSession();
  const denied = await requireApiPermission(session, "articles", "read");
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") as ArticleStatus | null;
  try {
    const articles = await getAllArticles(status || undefined);
    return NextResponse.json({ articles });
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}
