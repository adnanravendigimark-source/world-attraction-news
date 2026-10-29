import { permanentRedirect, notFound } from "next/navigation";
import { getPublishedArticleByAnySlug } from "@/lib/articles";
import { articlePath } from "@/lib/destinations";


// Legacy route. Articles live at /[country]/[city]/[slug] now (see
// lib/destinations.ts) — this pre-restructure URL shape is no longer linked
// to from anywhere on the site, but real visitors
// may still have it bookmarked or shared, and it may be indexed from before
// the restructure. Rather than silently 404 those visitors, or fully
// re-render the article a second time under a second live URL (duplicate
// content, and this route's own canonical/JSON-LD previously and incorrectly
// pointed at itself instead of the real URL), permanently redirect straight
// to the real article page.
// Empty list = nothing prebuilt at deploy; each page renders on first visit,
// then is served from cache until a publish/edit purges it (lib/revalidateSite.ts).
export async function generateStaticParams() {
  return [];
}

export default async function LegacyLatestNewsArticleRedirect({
  params,
}: {
  params: { slug: string };
}) {
  const article = await getPublishedArticleByAnySlug(params.slug);
  if (!article) notFound();
  permanentRedirect(articlePath(article.countrySlug, article.citySlug, article.slug));
}
