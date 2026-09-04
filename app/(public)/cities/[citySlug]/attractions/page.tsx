import { notFound, permanentRedirect } from "next/navigation";
import { getCityBySlug } from "@/lib/cities";
import { attractionsPath } from "@/lib/destinations";

// Legacy URL shim — see app/(public)/cities/[citySlug]/page.tsx for why this
// route only redirects rather than rendering.
export const dynamic = "force-dynamic";

export default async function LegacyCityAttractionsRedirect({ params }: { params: { citySlug: string } }) {
  const city = await getCityBySlug(params.citySlug);
  if (!city) notFound();
  permanentRedirect(attractionsPath(city.countrySlug, city.slug));
}
