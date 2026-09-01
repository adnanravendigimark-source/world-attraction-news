import { redirect } from "next/navigation";

// Login moved to the top-level /login route (see app/login/page.tsx) so it
// sits outside the /dashboard middleware gate. This stub only exists so old
// bookmarks/links to /dashboard/login still land somewhere useful.
export default function LegacyDashboardLoginRedirect() {
  redirect("/login");
}
