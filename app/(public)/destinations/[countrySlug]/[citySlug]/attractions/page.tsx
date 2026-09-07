import { permanentRedirect } from "next/navigation";
import { attractionsPath } from "@/lib/destinations";

// Legacy URL shim — see app/(public)/destinations/[countrySlug]/page.tsx.
export const dynamic = "force-dynamic";

export default function LegacyAttractionsRedirect({
  params,
}: {
  params: { countrySlug: string; citySlug: string };
}) {
  permanentRedirect(attractionsPath(params.countrySlug, params.citySlug));
}
