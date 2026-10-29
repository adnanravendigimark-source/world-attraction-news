import { NextResponse } from "next/server";
import { cronDenied } from "@/lib/cronAuth";
import { revalidatePath, revalidateTag } from "next/cache";
import { publishDueScheduledArticles } from "@/lib/scheduling";
import { revalidateSite } from "@/lib/revalidateSite";

export const dynamic = "force-dynamic";

// Meant to be hit on a regular interval by a platform scheduler (Vercel
// Cron — see vercel.json, configured for every 3 hours) so scheduled
// articles go live automatically without an admin needing to be online.
// Runs every 3 hours (vercel.json) — public reads no longer call it, so a
// cached page view never writes to the DB. Admin article lists still call it
// (getAllArticles), so an editor looking at the dashboard also publishes
// anything due.
//
// Protected by CRON_SECRET (set in your Vercel project's environment
// variables) so this can't be triggered by anyone who finds the URL —
// Vercel Cron sends this automatically as a Bearer token; see
// https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs.
export async function GET(req: Request) {
  const denied = cronDenied(req);
  if (denied) return denied;
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
    // Public pages are fully cached now; purge everything a new article can appear on.
    revalidateSite();
  }
  return NextResponse.json({ ok: true, published: publishedCount });
}
