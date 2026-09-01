import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getAllArticles, type ArticleStatus } from "@/lib/articles";
import { dbErrorMessage } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") as ArticleStatus | null;
  try {
    const articles = await getAllArticles(status || undefined);
    return NextResponse.json({ articles });
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}
