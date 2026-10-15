import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Container from "@/components/Container";
import NewsletterForm from "@/components/NewsletterForm";
import SocialShare from "@/components/SocialShare";
import CategoryIcon from "@/components/CategoryIcon";
import { KeyUpdatesBox, TravelerStepsBox } from "@/components/NewsBoxes";
import PhotoCredit from "@/components/PhotoCredit";
import {
  getArticleSources,
  getPublishedNews,
  getPublishedNewsBySlug,
  getStoryCountsByCategory,
  incrementArticleView,
} from "@/lib/articles";
import { getCategories } from "@/lib/categories";
import { getClientIpFromHeaders } from "@/lib/rateLimit";
import { breadcrumbJsonLd, jsonLdScript, newsArticleJsonLd, resolvePageMetadata } from "@/lib/seo";
import { getImageMeta, isNewsCoverSize } from "@/lib/news/images";
import { getLinks, relatedBoxItems } from "@/lib/news/internalLinks";
import { getExtra } from "@/lib/news/seo";
import { getPageIndexing } from "@/lib/indexing";
import { popularCategories, storyHref, storyDate, storyLabel } from "@/lib/home";
import { SITE_URL } from "@/lib/site";

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

  // Count the view (once per reader per 30 minutes), as guide pages do.
  article.viewCount = await incrementArticleView(article.id, getClientIpFromHeaders(headers())).catch(() => article.viewCount);

  const [sources, imageMeta, links, latest, categories, newsCounts] = await Promise.all([
    getArticleSources(article.id).catch(() => []),
    getImageMeta(article.id),
    getLinks(article.id).catch(() => []),
    getPublishedNews({ limit: 6 }).catch(() => ({ articles: [], total: 0 })),
    getCategories().catch(() => []),
    getStoryCountsByCategory("news").catch(() => ({} as Record<string, number>)),
  ]);

  const path = `/news/${article.slug}`;
  const categoryLabel = storyLabel(article);
  const categoryHref = article.categorySlug ? `/news?category=${encodeURIComponent(article.categorySlug)}` : "/news";
  const related = relatedBoxItems(links);
  const latestNews = latest.articles.filter((a) => a.id !== article.id).slice(0, 5);
  // Categories with news link to the filtered news list, others to their page.
  const sidebarCategories = popularCategories(categories, newsCounts, 6).map((c) => ({
    ...c,
    href: newsCounts[c.id] ? `/news?category=${encodeURIComponent(c.slug)}` : `/categories/${c.slug}`,
  }));
  const hasBoxes = article.keyUpdates.length > 0 || article.travelerSteps.length > 0;
  const showUpdated = article.updatedAt && article.publishedAt && fmt(article.updatedAt) !== fmt(article.publishedAt);

  return (
    <div className="bg-white min-h-screen text-ink-900 pb-20">
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
          __html: jsonLdScript(
            breadcrumbJsonLd([
              { name: "Home", path: "/" },
              { name: "Travel News", path: "/news" },
              ...(article.categorySlug ? [{ name: categoryLabel, path: categoryHref }] : []),
              { name: article.title, path },
            ])
          ),
        }}
      />

      <Container className="pt-6 sm:pt-8">
        {/* =========================================
            1. BREADCRUMBS
        ========================================= */}
        <nav className="flex items-center gap-2 text-xs text-gray-500 font-medium mb-4 sm:mb-6 overflow-x-auto no-scrollbar">
          <Link href="/" className="hover:text-ink-900 transition-colors shrink-0">
            Home
          </Link>
          <span className="text-gray-400 shrink-0">&gt;</span>
          <Link href="/news" className="hover:text-ink-900 transition-colors shrink-0">
            Travel News
          </Link>
          {article.categorySlug && (
            <>
              <span className="text-gray-400 shrink-0">&gt;</span>
              <Link href={categoryHref} className="text-gray-600 shrink-0 hover:text-ink-900 transition-colors">
                {categoryLabel}
              </Link>
            </>
          )}
          <span className="text-gray-400 shrink-0">&gt;</span>
          <span className="text-ink-900 font-semibold truncate max-w-xs sm:max-w-md">
            {article.title}
          </span>
        </nav>

        {/* =========================================
            2. 2-COLUMN ARTICLE LAYOUT
        ========================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
          {/* =========================================
              LEFT COLUMN: MAIN ARTICLE (8 COLS)
          ========================================= */}
          <article className="lg:col-span-8 flex flex-col min-w-0">
            {/* Category tag */}
            <div>
              <span className="text-[11px] font-black uppercase tracking-wider text-signal">
                {categoryLabel}
              </span>
            </div>

            {/* Main Headline */}
            <h1 className="mt-2 font-serif text-3xl sm:text-4xl lg:text-[44px] font-black text-ink-900 leading-[1.15] tracking-tight">
              {article.title}
            </h1>

            {/* Excerpt / Dek */}
            {article.excerpt && (
              <p className="mt-3.5 text-sm sm:text-base leading-relaxed text-gray-600 font-normal">
                {article.excerpt}
              </p>
            )}

            {/* Author & Share Bar */}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-y border-gray-100 py-3.5">
              {/* Left: Author + Date */}
              <div className="flex items-center gap-3">
                <div className="relative h-9 w-9 rounded-full overflow-hidden bg-gray-200 shrink-0">
                  <Image
                    src="/images/logo-emblem.png"
                    alt="World Attraction News avatar"
                    fill
                    sizes="36px"
                    className="object-cover p-1"
                  />
                </div>
                <div>
                  <p className="text-xs font-bold text-ink-900">
                    By{" "}
                    {article.authorSlug ? (
                      <Link href={`/author/${article.authorSlug}`} className="hover:underline">
                        {article.authorName}
                      </Link>
                    ) : (
                      article.authorName
                    )}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    <time dateTime={article.publishedAt || undefined}>{fmt(article.publishedAt)}</time>
                    {showUpdated && <> • Updated {fmt(article.updatedAt)}</>}
                    {article.readingTimeMinutes ? <> • {article.readingTimeMinutes} min read</> : null}
                  </p>
                </div>
              </div>

              {/* Right: Circular Social Share Buttons */}
              <div className="flex items-center gap-2">
                <SocialShare url={`${SITE_URL}${path}`} title={article.title} />
              </div>
            </div>

            {/* Hero Feature Image */}
            {article.image && (
              <figure className="mt-6">
                <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl bg-gray-100 shadow-2xs">
                  <Image
                    src={article.image}
                    alt={article.imageAlt || article.title}
                    fill
                    priority
                    sizes="(min-width: 1024px) 66vw, 100vw"
                    className="object-cover object-center"
                  />
                </div>
                {/* Credit is required by the photo's licence (Wikimedia, Unsplash). */}
                <PhotoCredit info={imageMeta} className="mt-2 text-xs text-gray-500 leading-snug" />
              </figure>
            )}

            {/* Article Content, with the Key Updates / What Travelers Should Do
                boxes beside it on desktop. On phones: Key Updates above the
                story, the steps below it. */}
            {hasBoxes ? (
              <div className="mt-7 lg:grid lg:grid-cols-12 lg:items-start lg:gap-8">
                <KeyUpdatesBox items={article.keyUpdates} className="mb-7 lg:hidden" />
                <div className="article-body news-body news-body--beside min-w-0 lg:col-span-7" dangerouslySetInnerHTML={{ __html: article.contentHtml }} />
                <TravelerStepsBox items={article.travelerSteps} className="mt-8 lg:hidden" />
                <div className="hidden space-y-8 lg:sticky lg:top-24 lg:col-span-5 lg:block">
                  <KeyUpdatesBox items={article.keyUpdates} />
                  <TravelerStepsBox items={article.travelerSteps} />
                </div>
              </div>
            ) : (
              <div className="article-body news-body mt-7" dangerouslySetInnerHTML={{ __html: article.contentHtml }} />
            )}

            {/* This site's pages the story mentions */}
            {related.length > 0 && (
              <section className="mt-10 border-t border-gray-100 pt-6" aria-labelledby="related-heading">
                <h2 id="related-heading" className="text-xs font-bold uppercase tracking-wider text-gray-500">
                  Related on World Attraction News
                </h2>
                <ul className="mt-3 flex flex-wrap gap-2 text-sm">
                  {related.map((r) => (
                    <li key={r.url}>
                      <Link href={r.url} className="inline-block rounded-full border border-gray-200 px-3 py-1 text-ink-800 hover:border-gray-400">
                        {r.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Sources / Editorial Note */}
            {sources.length > 0 && (
              <div className="mt-10 rounded-xl bg-gray-50 border border-gray-100 p-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                  Reporting based on
                </h3>
                <ul className="mt-2.5 space-y-1.5 text-xs">
                  {sources.map((s) => (
                    <li key={s.n}>
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="text-ink-800 underline hover:text-signal"
                      >
                        {s.publisher || s.title}
                      </a>
                      {s.isOfficial && <span className="text-gray-500"> (official)</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="mt-4 text-xs text-gray-500">
              Written from the reports above and checked against them before publishing. Rules and schedules can change: check the
              official source before you travel.{" "}
              <Link href="/editorial-policy" className="underline underline-offset-2 hover:text-ink-800">
                How we report
              </Link>
            </p>
          </article>

          {/* =========================================
              RIGHT COLUMN: SIDEBAR (4 COLS)
          ========================================= */}
          <aside className="lg:col-span-4 space-y-8">
            {/* -----------------------------------------
                WIDGET 1: LATEST TRAVEL NEWS
            ----------------------------------------- */}
            {latestNews.length > 0 && (
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-2xs">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
                <div className="flex items-center">
                  <span className="h-4 w-1 bg-signal rounded-full mr-2 inline-block" />
                  <h3 className="font-serif text-base font-bold text-ink-900 tracking-tight">
                    Latest Travel News
                  </h3>
                </div>
                <Link
                  href="/news"
                  className="text-xs text-signal font-bold hover:underline inline-flex items-center gap-0.5"
                >
                  <span>View all</span>
                  <span>→</span>
                </Link>
              </div>

              {/* 5 News Items */}
              <div className="space-y-3.5">
                {latestNews.map((item) => (
                  <Link
                    key={item.id}
                    href={storyHref(item)}
                    className="group flex items-start gap-3 p-1 rounded-xl transition hover:bg-gray-50"
                  >
                    <div className="relative h-15 w-18 shrink-0 overflow-hidden rounded-lg bg-gray-100 shadow-2xs">
                      {item.image && (
                      <Image
                        src={item.image}
                        alt={item.imageAlt || item.title}
                        fill
                        sizes="72px"
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-gray-500 font-medium uppercase">
                        {storyDate(item.publishedAt)}
                      </p>
                      <h4 className="font-sans text-xs font-bold leading-snug text-ink-900 group-hover:text-signal transition-colors line-clamp-2 mt-0.5">
                        {item.title}
                      </h4>
                      <p className="text-[9.5px] font-black uppercase tracking-wider text-signal mt-1">
                        {storyLabel(item)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
            )}

            {/* -----------------------------------------
                WIDGET 2: POPULAR CATEGORIES
            ----------------------------------------- */}
            {sidebarCategories.length > 0 && (
            <div className="rounded-2xl border border-gray-100 bg-[#f8fafc] p-5 shadow-2xs">
              <div className="flex items-center mb-3 pb-2 border-b border-gray-200/60">
                <span className="h-4 w-1 bg-signal rounded-full mr-2 inline-block" />
                <h3 className="font-serif text-base font-bold text-ink-900 tracking-tight">
                  Popular Categories
                </h3>
              </div>

              <div className="space-y-1">
                {sidebarCategories.map((cat) => (
                  <Link
                    key={cat.slug}
                    href={cat.href}
                    className="group flex items-center justify-between p-2 rounded-xl text-xs font-semibold text-gray-700 hover:text-signal hover:bg-white transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-signal transition-transform group-hover:scale-105">
                        <CategoryIcon slug={cat.slug} className="h-4 w-4" />
                      </span>
                      <span className="text-ink-800 group-hover:text-signal transition-colors">
                        {cat.name}
                      </span>
                    </div>
                    <span aria-hidden="true" className="text-gray-400 group-hover:text-signal group-hover:translate-x-0.5 transition-all font-bold">
                      →
                    </span>
                  </Link>
                ))}
              </div>
            </div>
            )}

            {/* -----------------------------------------
                WIDGET 3: GET TRAVEL NEWS IN YOUR INBOX
            ----------------------------------------- */}
            <div className="relative overflow-hidden rounded-2xl bg-[#0f2847] p-5 sm:p-6 text-white shadow-md">
              {/* Background Photo Watermark */}
              <div className="absolute inset-0 opacity-20 pointer-events-none">
                <Image
                  src="/images/trending/trending-europe.jpg"
                  alt="Coastal background"
                  fill
                  sizes="320px"
                  className="object-cover"
                />
              </div>

              <div className="relative z-10">
                {/* Airplane Badge */}
                <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-signal text-white shadow-sm">
                  <svg className="h-5 w-5 fill-none stroke-current" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </div>

                <h3 className="font-sans text-base font-bold text-white leading-tight">
                  Get Travel News in Your Inbox
                </h3>
                <p className="mt-1.5 text-xs text-gray-300 leading-relaxed">
                  Subscribe to receive the latest travel news, updates and alerts.
                </p>

                <div className="mt-4">
                  <NewsletterForm source="single-news-sidebar" variant="light" placeholder="Enter your email address" />
                </div>
              </div>
            </div>
          </aside>
        </div>
      </Container>
    </div>
  );
}
