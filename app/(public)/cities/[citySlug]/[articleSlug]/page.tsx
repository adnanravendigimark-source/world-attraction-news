import { notFound, permanentRedirect } from "next/navigation";
import { getCityBySlug } from "@/lib/cities";
import { articlePath } from "@/lib/destinations";

// Legacy URL shim — see app/(public)/cities/[citySlug]/page.tsx for why this
// route only redirects rather than rendering. Deliberately does NOT call
// incrementArticleView() (unlike the real article page) — a redirect isn't
// a real read of the article, the destination page's own render is.
export const dynamic = "force-dynamic";

export default async function LegacyArticleRedirect({
  params,
}: {
  params: { citySlug: string; articleSlug: string };
}) {
  const city = await getCityBySlug(params.citySlug);
  if (!city) notFound();
  permanentRedirect(articlePath(city.countrySlug, city.slug, params.articleSlug));
}
