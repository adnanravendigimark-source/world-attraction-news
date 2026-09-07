import { permanentRedirect } from "next/navigation";
import { cityPath } from "@/lib/destinations";

// Legacy URL shim — see the sibling .../[countrySlug]/page.tsx for why this
// only rewrites the path (no DB lookup) and lets the real page 404 if the
// slugs turn out to be invalid.
export const dynamic = "force-dynamic";

export default function LegacyCityRedirect({
  params,
}: {
  params: { countrySlug: string; citySlug: string };
}) {
  permanentRedirect(cityPath(params.countrySlug, params.citySlug));
}
