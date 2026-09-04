import { NextResponse } from "next/server";
import { incrementArticleView } from "@/lib/articles";
import { getClientIp } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const articleId = params.id;
    if (!articleId) {
      return NextResponse.json({ error: "Missing article ID" }, { status: 400 });
    }

    const ip = getClientIp(req);
    const viewCount = await incrementArticleView(articleId, ip);

    return NextResponse.json({
      success: true,
      viewCount,
    });
  } catch (err) {
    console.error("[api/articles/[id]/view] Error tracking view:", err);
    return NextResponse.json({ error: "Failed to record view" }, { status: 500 });
  }
}
