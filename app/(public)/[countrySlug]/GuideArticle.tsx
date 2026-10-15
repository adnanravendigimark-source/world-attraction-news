// One guide article page, shared by city guides (/[country]/[city]/[slug])
// and country-level guides (/[country]/[slug]). Counts the view, renders the
// article and its FAQ, and adds Article (+ FAQPage) structured data.

import { headers } from "next/headers";
import ArticleDetailClient from "@/components/ArticleDetailClient";
import { getRelatedPublishedArticles, getTrendingArticles, incrementArticleView, type ArticleWithRelations } from "@/lib/articles";
import { getClientIpFromHeaders } from "@/lib/rateLimit";
import { articleJsonLd, faqJsonLd, jsonLdScript } from "@/lib/seo";
import { articlePath } from "@/lib/destinations";
import { publishedClusterArticles } from "@/lib/blogs/clusters";
import { getImageMeta } from "@/lib/news/images";

// countView is off on cached (ISR) routes, where reading request headers
// is not allowed; the country-level route is one of those.
export default async function GuideArticle({ article, countView = true }: { article: ArticleWithRelations; countView?: boolean }) {
  if (countView) {
    const ip = getClientIpFromHeaders(headers());
    article.viewCount = await incrementArticleView(article.id, ip);
  }
  // Research sources are for editors (admin, fact check), not shown publicly.
  const [related, trending, series, imageMeta] = await Promise.all([
    article.cityId ? getRelatedPublishedArticles(article.cityId, article.id, 4) : Promise.resolve([]),
    getTrendingArticles(5),
    publishedClusterArticles(article.id).catch(() => []),
    getImageMeta(article.id),
  ]);
  // The cover's credit (its licence requires it) or AI-image note.
  const photoCredit = { sourceType: imageMeta.sourceType, credit: imageMeta.credit, license: imageMeta.license, sourceUrl: imageMeta.sourceUrl };
  const path = articlePath(article.countrySlug, article.citySlug, article.slug);
  const faq = faqJsonLd(article.faq);
  return (
    <>
      <ArticleDetailClient
        article={article}
        relatedStories={related}
        trendingStories={trending}
        series={series}
        photoCredit={photoCredit}
        viewCounted={countView}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(
            articleJsonLd({
              title: article.title,
              description: article.excerpt,
              image: article.image,
              path,
              authorName: article.authorName,
              authorSlug: article.authorSlug,
              publishedAt: article.publishedAt,
              updatedAt: article.updatedAt,
              cityName: article.cityName || article.countryName || undefined,
            })
          ),
        }}
      />
      {faq && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(faq) }} />}
    </>
  );
}
