import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { replaceMediaItem } from "@/lib/media";
import { logActivity } from "@/lib/activity";
import { dbErrorMessage } from "@/lib/db";

export const dynamic = "force-dynamic";

// Uploads a new file in place of an existing media item and rewrites every
// real reference to the old URL (city/attraction hero, article cover,
// inline content_html) to point at the new one — not a cosmetic swap.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "Invalid media id." }, { status: 400 });

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }

  try {
    const { item, usage } = await replaceMediaItem(id, file);
    await logActivity(session, "media_replaced", { type: "media", id: String(item.id), label: item.filename }, {
      referencesUpdated:
        usage.cityHero.length + usage.attractionHero.length + usage.articleCover.length + usage.articleContent.length,
    });
    return NextResponse.json({ ok: true, item, usage });
  } catch (err) {
    const message = err instanceof Error ? err.message : dbErrorMessage(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
