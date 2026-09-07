import { permanentRedirect } from "next/navigation";
import { attractionPath } from "@/lib/destinations";

// Legacy URL shim — see app/(public)/destinations/[countrySlug]/page.tsx.
export const dynamic = "force-dynamic";

export default function LegacyAttractionRedirect({
  params,
}: {
  params: { countrySlug: string; citySlug: string; attractionSlug: string };
}) {
  permanentRedirect(attractionPath(params.countrySlug, params.citySlug, params.attractionSlug));
}
