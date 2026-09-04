import { notFound, permanentRedirect } from "next/navigation";
import { getCityBySlug } from "@/lib/cities";
import { attractionPath } from "@/lib/destinations";

// Legacy URL shim — see app/(public)/cities/[citySlug]/page.tsx for why this
// route only redirects rather than rendering.
export const dynamic = "force-dynamic";

export default async function LegacyAttractionRedirect({
  params,
}: {
  params: { citySlug: string; attractionSlug: string };
}) {
  const city = await getCityBySlug(params.citySlug);
  if (!city) notFound();
  permanentRedirect(attractionPath(city.countrySlug, city.slug, params.attractionSlug));
}
