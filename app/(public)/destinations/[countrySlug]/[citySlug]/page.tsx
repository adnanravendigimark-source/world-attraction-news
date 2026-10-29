import { permanentRedirect } from "next/navigation";
import { cityPath } from "@/lib/destinations";


// Legacy URL shim — see the sibling .../[countrySlug]/page.tsx for why this
// only rewrites the path (no DB lookup) and lets the real page 404 if the
// slugs turn out to be invalid.
//
// Empty list = nothing prebuilt at deploy; each page renders on first visit,
// then is served from cache until a publish/edit purges it (lib/revalidateSite.ts).
export async function generateStaticParams() {
  return [];
}

export default function LegacyCityRedirect({
  params,
}: {
  params: { countrySlug: string; citySlug: string };
}) {
  permanentRedirect(cityPath(params.countrySlug, params.citySlug));
}
