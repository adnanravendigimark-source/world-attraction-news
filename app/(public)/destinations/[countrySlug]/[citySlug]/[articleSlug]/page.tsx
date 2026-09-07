import { permanentRedirect } from "next/navigation";
import { articlePath } from "@/lib/destinations";

// Legacy URL shim — see app/(public)/destinations/[countrySlug]/page.tsx.
// Deliberately does NOT call incrementArticleView() — a redirect isn't a
// real read of the article, the destination page's own render is (same
// rule the /cities/* legacy shims follow).
export const dynamic = "force-dynamic";

export default function LegacyArticleRedirect({
  params,
}: {
  params: { countrySlug: string; citySlug: string; articleSlug: string };
}) {
  permanentRedirect(articlePath(params.countrySlug, params.citySlug, params.articleSlug));
}
