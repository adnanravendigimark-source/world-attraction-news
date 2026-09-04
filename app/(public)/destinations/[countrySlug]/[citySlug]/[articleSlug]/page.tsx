import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";
import ArticleDetailClient from "@/components/ArticleDetailClient";
import {
  getPublishedArticleBySlug,
  getPublishedArticleByAnySlug,
  getRelatedPublishedArticles,
  getTrendingArticles,
  incrementArticleView,
} from "@/lib/articles";
import { getClientIpFromHeaders } from "@/lib/rateLimit";
import { buildMetadata, resolvePageMetadata, newsArticleJsonLd, jsonLdScript } from "@/lib/seo";
import { articlePath } from "@/lib/destinations";
import { SITE_NAME } from "@/lib/site";

// Deliberately stays force-dynamic (not ISR like the other read-only public
// pages) — this page has a real per-request write, incrementArticleView()
// below, that has to run on every single visit for view counts to be
// accurate. Caching this route's render would skip that call on cache hits
// and silently undercount views (view count feeds "popular" sort elsewhere
// on the site), so full dynamic rendering is the correct choice here, not
// an oversight.
export const dynamic = "force-dynamic";

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
    title: `${article.metaTitle || article.title} | ${SITE_NAME}`,
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

  const ip = getClientIpFromHeaders(headers());
  await incrementArticleView(article.id, ip);

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
          __html: jsonLdScript(
            newsArticleJsonLd({
              title: article.title,
              description: article.excerpt,
              image: article.image,
              path: articlePath(article.countrySlug, article.citySlug, article.slug),
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
