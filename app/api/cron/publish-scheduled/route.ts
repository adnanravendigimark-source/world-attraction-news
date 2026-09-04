import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { publishDueScheduledArticles } from "@/lib/scheduling";

export const dynamic = "force-dynamic";

// Meant to be hit on a regular interval by a platform scheduler (Vercel
// Cron — see vercel.json, configured for every 5 minutes) so scheduled
// articles go live automatically without an admin needing to be online.
// Also called defensively from every public content read in
// lib/articles.ts, so this endpoint isn't the only thing making
// "automatic" actually true — it's what makes it prompt rather than
// "whenever the next visitor happens to load a page."
//
// Protected by CRON_SECRET (set in your Vercel project's environment
// variables) so this can't be triggered by anyone who finds the URL —
// Vercel Cron sends this automatically as a Bearer token; see
// https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  const publishedCount = await publishDueScheduledArticles();
  // Homepage and destination pages are ISR-cached (see their own
  // `revalidate` exports) — without this they'd still catch up on their own
  // within that window, but a scheduled article going live is exactly the
  // kind of "should show up promptly" change worth an explicit nudge here,
  // cheap as it is. Not scoped to specific cities/countries since this
  // function doesn't return which ones were affected — revalidating the
  // whole /destinations subtree plus the "articles" data-cache tag (which
  // every destination page's article fetch is tagged with) is still far
  // cheaper than the DB work the cron just did.
  if (publishedCount > 0) {
    revalidatePath("/");
    revalidatePath("/destinations", "layout");
    revalidateTag("homepage");
    revalidateTag("articles");
  }
  return NextResponse.json({ ok: true, published: publishedCount });
}
