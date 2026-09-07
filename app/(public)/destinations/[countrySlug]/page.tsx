import { permanentRedirect } from "next/navigation";
import { countryPath } from "@/lib/destinations";

// Legacy URL shim: /destinations/[country] moved to /[country] directly off
// the root as part of the URL restructure (/destinations is the browse
// index only now, never a prefix for an individual country/city page). Both
// segments already fully identify the target, so this just rewrites the
// path and lets the real page at app/(public)/[countrySlug]/page.tsx do its
// own existence check/404 — no DB lookup needed here.
export const dynamic = "force-dynamic";

export default function LegacyCountryRedirect({ params }: { params: { countrySlug: string } }) {
  permanentRedirect(countryPath(params.countrySlug));
}
