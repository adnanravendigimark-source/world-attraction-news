import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getArticleSources, getPublishedNews, getPublishedNewsBySlug } from "@/lib/articles";
import { breadcrumbJsonLd, jsonLdScript, newsArticleJsonLd, resolvePageMetadata } from "@/lib/seo";
import { getImageMeta, isNewsCoverSize } from "@/lib/news/images";
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
  const [sources, imageMeta, latest] = await Promise.all([
    getArticleSources(article.id),
    getImageMeta(article.id),
    getPublishedNews({ limit: 4, offset: 0 }).catch(() => ({ articles: [], total: 0 })),
  ]);
  const more = latest.articles.filter((a) => a.id !== article.id).slice(0, 3);
  const path = `/news/${article.slug}`;
  const showUpdated = article.updatedAt && article.publishedAt && fmt(article.updatedAt) !== fmt(article.publishedAt);

  return (
    <main className="mx-auto max-w-[44rem] px-5 pb-16 pt-8 sm:pt-12">
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

      <nav className="text-xs font-semibold uppercase tracking-[0.14em] text-[#C22938]">
        <Link href="/news" className="hover:underline">Travel News</Link>
        {article.categoryName && <span className="text-slate-400"> / {article.categoryName}</span>}
      </nav>

      <h1 className="mt-4 font-serif text-[2.1rem] font-bold leading-[1.12] tracking-tight text-[#111318] sm:text-[2.7rem]">{article.title}</h1>
      {article.excerpt && <p className="mt-4 font-serif text-xl leading-snug text-slate-600">{article.excerpt}</p>}

      <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 border-y border-slate-200 py-3 text-[13px] text-slate-500">
        <span className="font-semibold text-slate-800">
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
            <figcaption className="mt-2 text-xs text-slate-500">
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

      <div className="rich-content article-body news-body mt-9" dangerouslySetInnerHTML={{ __html: article.contentHtml }} />

      {sources.length > 0 && (
        <section className="mt-12 rounded-xl bg-slate-50 p-5">
          <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Reporting based on</h2>
          <ul className="mt-3 space-y-1.5 text-sm">
            {sources.map((s) => (
              <li key={s.n}>
                <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="text-slate-800 underline decoration-slate-300 underline-offset-2 hover:decoration-slate-700">
                  {s.publisher || s.title}
                </a>
                {s.isOfficial && <span className="text-slate-400"> (official)</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {more.length > 0 && (
        <section className="mt-14">
          <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">More travel news</h2>
          <ul className="mt-4 grid gap-5 sm:grid-cols-3">
            {more.map((a) => (
              <li key={a.id}>
                <Link href={`/news/${a.slug}`} className="group block">
                  {a.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.image} alt="" loading="lazy" className="mb-2 aspect-[16/10] w-full rounded-lg object-cover" />
                  )}
                  <span className="font-serif text-base font-bold leading-snug group-hover:underline">{a.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
