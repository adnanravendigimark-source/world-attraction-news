import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import GuideArticle from "../../GuideArticle";
import { getPublishedArticleBySlug, getPublishedArticleByAnySlug } from "@/lib/articles";
import { resolvePageMetadata } from "@/lib/seo";
import { articlePath } from "@/lib/destinations";


// Empty list = nothing prebuilt at deploy; each page renders on first visit,
// then is served from cache until a publish/edit purges it (lib/revalidateSite.ts).
export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: { countrySlug: string; citySlug: string; articleSlug: string };
}): Promise<Metadata> {
  let article = await getPublishedArticleBySlug(params.citySlug, params.articleSlug);
  if (!article) {
    article = await getPublishedArticleByAnySlug(params.articleSlug);
  }
  if (!article) return {};
  return resolvePageMetadata(articlePath(article.countrySlug, article.citySlug, article.slug), {
    title: article.metaTitle || article.title,
    description: article.metaDescription || article.excerpt,
    image: article.image,
    canonicalOverride: article.canonicalUrl || undefined,
  });
}

export default async function ArticlePage({
  params,
}: {
  params: { countrySlug: string; citySlug: string; articleSlug: string };
}) {
  let article = await getPublishedArticleBySlug(params.citySlug, params.articleSlug);
  if (!article) {
    article = await getPublishedArticleByAnySlug(params.articleSlug);
  }
  if (!article) notFound();

  if (article.countrySlug !== params.countrySlug || article.citySlug !== params.citySlug) {
    permanentRedirect(articlePath(article.countrySlug, article.citySlug, article.slug));
  }

  return <GuideArticle article={article} />;
}
