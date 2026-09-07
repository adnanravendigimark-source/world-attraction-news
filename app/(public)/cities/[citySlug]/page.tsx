import { notFound, permanentRedirect } from "next/navigation";
import { getCityBySlug } from "@/lib/cities";
import { cityPath } from "@/lib/destinations";

// Legacy URL shim: /cities/[citySlug] moved to /[country]/[city] as part of
// the country+city URL restructure. This route no longer renders
// any content itself — it only looks up the city's current country and
// permanently (308) redirects, so old links and search engine indexing
// carry over instead of breaking.
export const dynamic = "force-dynamic";

export default async function LegacyCityRedirect({ params }: { params: { citySlug: string } }) {
  const city = await getCityBySlug(params.citySlug);
  if (!city) notFound();
  permanentRedirect(cityPath(city.countrySlug, city.slug));
}
