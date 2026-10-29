import { permanentRedirect } from "next/navigation";
import { articlePath } from "@/lib/destinations";


// Legacy URL shim — see app/(public)/destinations/[countrySlug]/page.tsx.
// Deliberately does NOT call incrementArticleView() — a redirect isn't a
// real read of the article, the destination page's own render is (same
// rule the /cities/* legacy shims follow).
//
// Empty list = nothing prebuilt at deploy; each page renders on first visit,
// then is served from cache until a publish/edit purges it (lib/revalidateSite.ts).
export async function generateStaticParams() {
  return [];
}

export default function LegacyArticleRedirect({
  params,
}: {
  params: { countrySlug: string; citySlug: string; articleSlug: string };
}) {
  permanentRedirect(articlePath(params.countrySlug, params.citySlug, params.articleSlug));
}
