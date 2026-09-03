import { redirect } from "next/navigation";

// Catches every other old /dashboard/* bookmark (e.g. /dashboard/articles,
// /dashboard/articles/abc123/edit, /dashboard/points, /dashboard/profile)
// and forwards it to the matching /contributor/* path — see
// app/dashboard/page.tsx for the bare /dashboard case, and
// app/dashboard/{login,signup,new,edit/[id]}/page.tsx for the handful of
// old paths with a different final destination that already have their own
// more-specific stub here (Next.js prefers that exact match over this
// catch-all).
export default function LegacyDashboardCatchAllRedirect({ params }: { params: { slug: string[] } }) {
  redirect(`/contributor/${params.slug.join("/")}`);
}
