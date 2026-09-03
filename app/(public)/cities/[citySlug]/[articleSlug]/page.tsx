import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ArticleDetailClient from "@/components/ArticleDetailClient";
import {
  getPublishedArticleBySlug,
  getRelatedPublishedArticles,
  getTrendingArticles,
  incrementArticleView,
} from "@/lib/articles";
import { buildMetadata, newsArticleJsonLd } from "@/lib/seo";
import { SITE_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { citySlug: string; articleSlug: string };
}): Promise<Metadata> {
  const article = await getPublishedArticleBySlug(params.citySlug, params.articleSlug);
  if (!article) return {};
  return buildMetadata({
    title: `${article.metaTitle || article.title} | ${SITE_NAME}`,
    description: article.metaDescription || article.excerpt,
    path: `/cities/${article.citySlug}/${article.slug}`,
    image: article.image,
    canonicalOverride: article.canonicalUrl || undefined,
  });
}

export default async function ArticlePage({
  params,
}: {
  params: { citySlug: string; articleSlug: string };
}) {
  const article = await getPublishedArticleBySlug(params.citySlug, params.articleSlug);
  if (!article) notFound();

  await incrementArticleView(article.id);

  const [related, trending] = await Promise.all([
    getRelatedPublishedArticles(article.cityId, article.id, 4),
    getTrendingArticles(5),
  ]);

  return (
    <>
      <ArticleDetailClient
        article={article}
        relatedStories={related}
        trendingStories={trending}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            newsArticleJsonLd({
              title: article.title,
              description: article.excerpt,
              image: article.image,
              path: `/cities/${article.citySlug}/${article.slug}`,
              authorName: article.authorName,
              authorSlug: article.authorSlug,
              publishedAt: article.publishedAt,
              updatedAt: article.updatedAt,
              cityName: article.cityName,
            })
          ),
        }}
      />
    </>
  );
}
