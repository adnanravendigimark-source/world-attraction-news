import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getArticleSources, getPublishedNews, getPublishedNewsBySlug, getTrendingArticles, type ArticleWithRelations } from "@/lib/articles";
import Container from "@/components/Container";
import ArticleSidebar, { type SidebarItem } from "@/components/ArticleSidebar";
import { publicPath } from "@/lib/content/paths";
import { breadcrumbJsonLd, jsonLdScript, newsArticleJsonLd, resolvePageMetadata } from "@/lib/seo";
import { getImageMeta, isNewsCoverSize } from "@/lib/news/images";
import { getLinks, relatedBoxItems } from "@/lib/news/internalLinks";
import { getExtra } from "@/lib/news/seo";
import { getPageIndexing } from "@/lib/indexing";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const article = await getPublishedNewsBySlug(params.slug);
  if (!article) return {};
  // A noindex set in Admin -> Indexing is stored under the article key
  // (article:<id>) or under the URL; either one applies.
  const path = `/news/${article.slug}`;
  const [byKey, byPath] = await Promise.all([getPageIndexing(`article:${article.id}`), getPageIndexing(path)]);
  const [meta, extra] = await Promise.all([
    resolvePageMetadata(path, {
      title: article.metaTitle || article.title, // the root layout appends the site name
      description: article.metaDescription || article.excerpt,
      image: article.image,
      canonicalOverride: article.canonicalUrl || undefined,
      noIndex: byKey.noIndex || byPath.noIndex,
      noFollow: byKey.noFollow || byPath.noFollow,
    }),
    getExtra(article.id),
  ]);
  if (extra.ogTitle || extra.ogDescription) {
    meta.openGraph = { ...meta.openGraph, ...(extra.ogTitle ? { title: extra.ogTitle } : {}), ...(extra.ogDescription ? { description: extra.ogDescription } : {}), type: "article" } as any;
  }
  if (extra.secondaryKeywords.length) meta.keywords = [article.focusKeyword, ...extra.secondaryKeywords].filter(Boolean);
  return meta;
}

function fmt(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export default async function NewsArticlePage({ params }: { params: { slug: string } }) {
  const article = await getPublishedNewsBySlug(params.slug);
  if (!article) notFound();
  const [sources, imageMeta, latest, links, trending] = await Promise.all([
    getArticleSources(article.id),
    getImageMeta(article.id),
    getPublishedNews({ limit: 5, offset: 0 }).catch(() => ({ articles: [], total: 0 })),
    getLinks(article.id),
    getTrendingArticles(5).catch(() => []),
  ]);
  // Related box: this site's pages the story links to or mentions. Hidden
  // when there are none.
  const related = relatedBoxItems(links);
  const more = latest.articles.filter((a) => a.id !== article.id).slice(0, 4);
  const place = article.cityName || article.countryName || "";
  const path = `/news/${article.slug}`;
  const showUpdated = article.updatedAt && article.publishedAt && fmt(article.updatedAt) !== fmt(article.publishedAt);

  return (
    <main className="min-h-screen bg-white pb-20 text-ink-900">
      <Container className="pt-5 sm:pt-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(
            newsArticleJsonLd({
              title: article.title,
              description: article.metaDescription || article.excerpt,
              image: article.image,
              imageSize: isNewsCoverSize(imageMeta, article.image) ? { width: imageMeta.width!, height: imageMeta.height! } : null,
              path,
              authorName: article.authorName,
              authorSlug: article.authorSlug,
              publishedAt: article.publishedAt,
              updatedAt: article.updatedAt,
              section: article.categoryName,
              keywords: article.tags,
            })
          ),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "News", path: "/news" }, { name: article.title, path }])),
        }}
      />

      {/* Same frame as blog guides: breadcrumbs, then article (8 cols) + sidebar (4 cols). */}
      <nav className="mb-5 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-ink-400">
        <Link href="/" className="transition-colors hover:text-ink-900">Home</Link>
        <span>&gt;</span>
        <Link href="/news" className="transition-colors hover:text-ink-900">Travel News</Link>
        {place && (
          <>
            <span>&gt;</span>
            <span>{place}</span>
          </>
        )}
        <span>&gt;</span>
        <span className="line-clamp-1 max-w-[280px] text-ink-800 sm:max-w-md">{article.title}</span>
      </nav>

      <div className="grid items-start gap-10 lg:grid-cols-12">
      <article className="flex min-w-0 flex-col lg:col-span-8">
      <div className="mb-2.5 flex items-center gap-2 text-xs font-black uppercase tracking-wider">
        {place && (
          <>
            <span className="text-signal">{place.toUpperCase()}</span>
            <span className="text-ink-300">|</span>
          </>
        )}
        <span className="text-ink-500">TRAVEL NEWS</span>
      </div>

      <h1 className="font-serif text-3xl font-black leading-[1.15] tracking-tight text-ink-900 sm:text-4xl lg:text-[42px]">{article.title}</h1>
      {article.excerpt && <p className="mt-3 font-serif text-base italic leading-relaxed text-ink-600 sm:text-lg">{article.excerpt}</p>}

      <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 border-y border-ink-200 py-3 text-[13px] text-ink-500">
        <span className="font-semibold text-ink-800">
          {article.authorSlug ? <Link href={`/author/${article.authorSlug}`} className="hover:underline">{article.authorName}</Link> : article.authorName}
        </span>
        <span aria-hidden>·</span>
        <time dateTime={article.publishedAt || undefined}>{fmt(article.publishedAt)}</time>
        {showUpdated && (
          <>
            <span aria-hidden>·</span>
            <span>Updated {fmt(article.updatedAt)}</span>
          </>
        )}
        {article.readingTimeMinutes ? (
          <>
            <span aria-hidden>·</span>
            <span>{article.readingTimeMinutes} min read</span>
          </>
        ) : null}
      </div>

      {article.image && (
        <figure className="mt-7">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={article.image} alt={article.imageAlt || article.title} width={1200} height={675} className="w-full rounded-xl object-cover" style={{ aspectRatio: "16 / 9" }} />
          {(imageMeta.credit || imageMeta.sourceType === "ai") && (
            <figcaption className="mt-2 text-xs text-ink-500">
              {imageMeta.sourceType === "ai" ? (
                "Illustrative image generated with AI. It does not show the actual event."
              ) : imageMeta.sourceUrl ? (
                <>
                  Photo: <a href={imageMeta.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">{imageMeta.credit}</a>
                  {imageMeta.license ? ` · ${imageMeta.license}` : ""}
                </>
              ) : (
                `Photo: ${imageMeta.credit}`
              )}
            </figcaption>
          )}
        </figure>
      )}

      <div className="article-body news-body mt-9" dangerouslySetInnerHTML={{ __html: article.contentHtml }} />

      {related.length > 0 && (
        <section className="mt-12 border-t border-ink-200 pt-6" aria-labelledby="related-heading">
          <h2 id="related-heading" className="text-xs font-bold uppercase tracking-[0.14em] text-ink-500">Related on World Attraction News</h2>
          <ul className="mt-3 flex flex-wrap gap-2 text-sm">
            {related.map((r) => (
              <li key={r.url}>
                <Link href={r.url} className="inline-block rounded-full border border-ink-200 px-3 py-1 text-ink-800 hover:border-ink-400">
                  {r.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {sources.length > 0 && (
        <section className="mt-12 rounded-xl bg-ink-50 p-5">
          <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-ink-500">Reporting based on</h2>
          <ul className="mt-3 space-y-1.5 text-sm">
            {sources.map((s) => (
              <li key={s.n}>
                <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="text-ink-800 underline decoration-ink-300 underline-offset-2 hover:decoration-ink-700">
                  {s.publisher || s.title}
                </a>
                {s.isOfficial && <span className="text-ink-400"> (official)</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="mt-4 text-xs text-ink-500">
        Written from the reports above and checked against them before publishing. Rules and schedules can change: check the official source before you travel.{" "}
        <Link href="/editorial-policy" className="underline underline-offset-2 hover:text-ink-800">How we report</Link>
      </p>

      </article>

      <div className="lg:col-span-4">
        <ArticleSidebar related={more.map(toSidebarItem)} relatedTitle="More Travel News" trending={trending.filter((t) => t.id !== article.id).map(toSidebarItem)} />
      </div>
      </div>
      </Container>
    </main>
  );
}

function toSidebarItem(a: ArticleWithRelations): SidebarItem {
  return {
    id: a.id,
    title: a.title,
    href: publicPath(a),
    image: a.image,
    eyebrow: a.cityName || a.countryName || (a.type === "news" ? "Travel News" : a.categoryName || ""),
    date: a.publishedAt,
    readingMinutes: a.readingTimeMinutes || 1,
  };
}
