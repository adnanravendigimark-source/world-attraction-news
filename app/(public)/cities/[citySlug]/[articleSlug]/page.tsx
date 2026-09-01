import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Container from "@/components/Container";
import Breadcrumbs from "@/components/Breadcrumbs";
import ArticleCard from "@/components/ArticleCard";
import SectionHeading from "@/components/SectionHeading";
import SocialShare from "@/components/SocialShare";
import NewsletterForm from "@/components/NewsletterForm";
import { getPublishedArticleBySlug, getRelatedPublishedArticles, getRelatedByCategoryPublishedArticles } from "@/lib/articles";
import { buildMetadata, breadcrumbJsonLd, newsArticleJsonLd } from "@/lib/seo";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { citySlug: string; articleSlug: string };
}): Promise<Metadata> {
  const article = await getPublishedArticleBySlug(params.citySlug, params.articleSlug);
  if (!article) return {};
  return buildMetadata({
    title: article.metaTitle || article.title,
    description: article.metaDescription || article.excerpt,
    path: `/cities/${article.citySlug}/${article.slug}`,
    image: article.image,
    canonicalOverride: article.canonicalUrl || undefined,
  });
}

function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

// Only shown when the article was genuinely edited after it went live —
// never a fabricated "updated" stamp on something that hasn't changed.
function wasActuallyUpdated(publishedAt: string | null, updatedAt: string) {
  if (!publishedAt || !updatedAt) return false;
  return new Date(updatedAt).getTime() - new Date(publishedAt).getTime() > 60_000;
}

export default async function ArticlePage({
  params,
}: {
  params: { citySlug: string; articleSlug: string };
}) {
  const article = await getPublishedArticleBySlug(params.citySlug, params.articleSlug);
  if (!article) notFound();

  const [relatedByCity, relatedByCategory] = await Promise.all([
    getRelatedPublishedArticles(article.cityId, article.id, 3),
    article.categoryId ? getRelatedByCategoryPublishedArticles(article.categoryId, article.id, 3) : Promise.resolve([]),
  ]);

  const path = `/cities/${article.citySlug}/${article.slug}`;
  const fullUrl = `${SITE_URL}${path}`;
  const updated = wasActuallyUpdated(article.publishedAt, article.updatedAt);

  const breadcrumbs = [
    { name: "Home", path: "/" },
    { name: article.cityName, path: `/cities/${article.citySlug}` },
    { name: article.title, path },
  ];

  return (
    <article>
      <Container className="pt-6">
        <Breadcrumbs items={breadcrumbs} />
        <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-signal">
          <Link href={`/cities/${article.citySlug}`} className="hover:underline">
            {article.cityName}
          </Link>
          {article.categoryName && article.categorySlug && (
            <>
              <span className="text-ink-300" aria-hidden="true">·</span>
              <Link href={`/categories/${article.categorySlug}`} className="text-ink-500 hover:text-signal hover:underline">
                {article.categoryName}
              </Link>
            </>
          )}
        </div>
        <h1 className="mt-2 max-w-3xl font-serif text-2xl font-bold leading-tight text-ink-900 sm:text-4xl">
          {article.title}
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-relaxed text-ink-600">{article.excerpt}</p>
        <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 border-y border-ink-100 py-3 text-xs text-ink-500">
          <span>
            By <span className="font-semibold text-ink-800">{article.authorName}</span>
          </span>
          <span aria-hidden="true">·</span>
          <span>Published {formatDate(article.publishedAt)}</span>
          {updated && (
            <>
              <span aria-hidden="true">·</span>
              <span>Updated {formatDate(article.updatedAt)}</span>
            </>
          )}
          <span aria-hidden="true">·</span>
          <span>{article.readingTimeMinutes} min read</span>
        </div>
      </Container>

      {article.image && (
        <Container className="mt-6">
          <div className="relative aspect-[16/9] overflow-hidden rounded-lg border border-ink-100">
            <Image
              src={article.image}
              alt={article.imageAlt || article.title}
              fill
              priority
              sizes="(min-width: 1024px) 70vw, 100vw"
              className="object-cover"
            />
          </div>
          {article.imageAlt && <p className="mt-2 text-center text-[11px] text-ink-400">{article.imageAlt}</p>}
        </Container>
      )}

      <Container className="py-8 sm:py-10">
        <div className="mx-auto max-w-prose">
          <div className="article-body" dangerouslySetInnerHTML={{ __html: article.contentHtml }} />

          {article.tags.length > 0 && (
            <div className="mt-8 flex flex-wrap gap-2 border-t border-ink-100 pt-6">
              {article.tags.map((tag) => (
                <span key={tag} className="rounded-full border border-ink-200 px-2.5 py-1 text-[11px] font-medium text-ink-600">
                  #{tag}
                </span>
              ))}
            </div>
          )}

          <div className="mt-6 flex items-center justify-between gap-4 border-t border-ink-100 pt-6">
            <SocialShare url={fullUrl} title={article.title} />
          </div>
        </div>
      </Container>

      {/* Newsletter CTA — placed right after the article body, where an
          engaged reader who just finished the story is most likely to
          subscribe. */}
      <section className="border-y border-ink-200 bg-ink-50 py-8">
        <Container>
          <div className="mx-auto max-w-2xl rounded-lg border border-ink-200 bg-white p-5 text-center sm:p-6">
            <p className="font-serif text-base font-bold text-ink-900">Enjoyed this story?</p>
            <p className="mt-1 text-xs text-ink-500">Get attraction news like this delivered weekly.</p>
            <div className="mx-auto mt-4 max-w-sm">
              <NewsletterForm source="article" />
            </div>
          </div>
        </Container>
      </section>

      {relatedByCity.length > 0 && (
        <section className="border-b border-ink-200 bg-white py-10 sm:py-12">
          <Container>
            <SectionHeading title={`More from ${article.cityName}`} href={`/cities/${article.citySlug}`} />
            <div className="mt-6 grid gap-6 sm:grid-cols-3">
              {relatedByCity.map((a) => (
                <ArticleCard key={a.id} article={a} />
              ))}
            </div>
          </Container>
        </section>
      )}

      {relatedByCategory.length > 0 && (
        <section className="bg-ink-50 py-10 sm:py-12">
          <Container>
            <SectionHeading
              title={`More in ${article.categoryName}`}
              href={article.categorySlug ? `/categories/${article.categorySlug}` : undefined}
            />
            <div className="mt-6 grid gap-6 sm:grid-cols-3">
              {relatedByCategory.map((a) => (
                <ArticleCard key={a.id} article={a} />
              ))}
            </div>
          </Container>
        </section>
      )}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(breadcrumbs)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            newsArticleJsonLd({
              title: article.title,
              description: article.excerpt,
              image: article.image,
              path,
              authorName: article.authorName,
              publishedAt: article.publishedAt,
              updatedAt: article.updatedAt,
              cityName: article.cityName,
            })
          ),
        }}
      />
    </article>
  );
}
