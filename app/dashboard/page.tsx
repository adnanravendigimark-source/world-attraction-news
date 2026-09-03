import { redirect } from "next/navigation";

// The Contributor area moved from /dashboard to /contributor/dashboard (and
// every other /dashboard/* page moved to the matching /contributor/* path —
// see app/dashboard/[...slug]/page.tsx for the rest of them). This stub only
// exists so old bookmarks/links to bare /dashboard still land somewhere
// useful.
export default function LegacyDashboardRootRedirect() {
  redirect("/contributor/dashboard");
}
