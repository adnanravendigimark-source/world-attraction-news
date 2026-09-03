import { redirect, notFound } from "next/navigation";
import { getPublishedArticleByAnySlug } from "@/lib/articles";

export const dynamic = "force-dynamic";

// Legacy route. Articles live at /cities/[citySlug]/[slug] (see the Phase 3
// URL restructure) — this pre-restructure URL shape is no longer linked to
// from anywhere on the site, but real visitors may still have it bookmarked
// or shared, and it may be indexed from before the restructure. Rather than
// silently 404 those visitors, or fully re-render the article a second time
// under a second live URL (duplicate content, and this route's own
// canonical/JSON-LD previously and incorrectly pointed at itself instead of
// the real URL), redirect straight to the real article page.
export default async function LegacyLatestNewsArticleRedirect({
  params,
}: {
  params: { slug: string };
}) {
  const article = await getPublishedArticleByAnySlug(params.slug);
  if (!article) notFound();
  redirect(`/cities/${article.citySlug}/${article.slug}`);
}
