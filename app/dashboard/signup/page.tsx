import { redirect } from "next/navigation";

// Signup moved to the top-level /signup route (see app/signup/page.tsx) so
// it sits outside the /dashboard middleware gate. This stub only exists so
// old bookmarks/links to /dashboard/signup still land somewhere useful.
export default function LegacyDashboardSignupRedirect() {
  redirect("/signup");
}
