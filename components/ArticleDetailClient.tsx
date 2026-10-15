"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import Container from "@/components/Container";
import ArticleSidebar, { type SidebarItem } from "@/components/ArticleSidebar";
import PhotoCredit, { type PhotoCreditInfo } from "@/components/PhotoCredit";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { publicPath } from "@/lib/content/paths";
import type { ArticleWithRelations } from "@/lib/articles";
import { cityPath, countryPath, articlePath } from "@/lib/destinations";

export default function ArticleDetailClient({
  article,
  relatedStories = [],
  trendingStories = [],
  series = [],
  photoCredit,
  viewCounted = false,
}: {
  article: ArticleWithRelations;
  relatedStories?: ArticleWithRelations[];
  trendingStories?: ArticleWithRelations[];
  // Published articles from the same topic cluster, main guide first.
  series?: { title: string; url: string; pillar: boolean }[];
  photoCredit?: PhotoCreditInfo;
  // True when the server already counted this view (GuideArticle); the
  // browser only counts on cached pages where the server cannot.
  viewCounted?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!article.id || viewCounted) return;
    fetch(`/api/articles/${article.id}/view`, { method: "POST" })
      .catch((err) => console.error("[ArticleDetailClient] view tracking error:", err));
  }, [article.id, viewCounted]);

  // Canonical address, the same on the server and in the browser.
  const fullUrl = `${SITE_URL}${articlePath(article.countrySlug, article.citySlug, article.slug)}`;

  const copyToClipboard = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const shareOnTwitter = () => {
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(article.title)}&url=${encodeURIComponent(fullUrl)}`,
      "_blank"
    );
  };

  const shareOnFacebook = () => {
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(fullUrl)}`,
      "_blank"
    );
  };

  const shareOnPinterest = () => {
    window.open(
      `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(fullUrl)}&media=${encodeURIComponent(article.image || "")}&description=${encodeURIComponent(article.title)}`,
      "_blank"
    );
  };

  const shareByEmail = () => {
    window.location.href = `mailto:?subject=${encodeURIComponent(article.title)}&body=${encodeURIComponent(`Read this on ${SITE_NAME}: ${fullUrl}`)}`;
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };




  return (
    <div className="bg-white min-h-screen text-ink-900 pb-20">
      <Container className="pt-5 sm:pt-6">
        {/* =========================================
            1. BREADCRUMBS
        ========================================= */}
        <nav className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-ink-400 mb-5">
          <Link href="/" className="hover:text-ink-900 transition-colors">
            Home
          </Link>
          <span>&gt;</span>
          <Link href="/latest-news" className="hover:text-ink-900 transition-colors">
            Travel Guides
          </Link>
          <span>&gt;</span>
          {article.citySlug ? (
            <Link href={cityPath(article.countrySlug, article.citySlug)} className="hover:text-ink-900 transition-colors">
              {article.cityName}
            </Link>
          ) : (
            <Link href={countryPath(article.countrySlug)} className="hover:text-ink-900 transition-colors">
              {article.countryName || article.countrySlug}
            </Link>
          )}
          <span>&gt;</span>
          <span className="text-ink-800 line-clamp-1 max-w-[280px] sm:max-w-md">{article.title}</span>
        </nav>

        {/* =========================================
            2. MAIN ARTICLE & SIDEBAR LAYOUT
        ========================================= */}
        <div className="grid gap-10 lg:grid-cols-12 items-start">
          {/* Main Article Content (68% / 8 cols) */}
          <div className="lg:col-span-8 flex flex-col">
            {/* Eyebrow */}
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider mb-2.5">
              <span className="text-signal">{(article.cityName || article.countryName || "")?.toUpperCase()}</span>
              {article.categoryName && (
                <>
                  <span className="text-ink-300">|</span>
                  <span className="text-ink-500">{article.categoryName.toUpperCase()}</span>
                </>
              )}
            </div>

            {/* Headline */}
            <h1 className="font-serif text-3xl sm:text-4xl lg:text-[42px] font-black tracking-tight text-ink-900 leading-[1.15]">
              {article.title}
            </h1>

            {/* Subtitle / Excerpt */}
            {article.excerpt && (
              <p className="mt-3 text-sm sm:text-base text-ink-600 italic leading-relaxed font-serif">
                {article.excerpt}
              </p>
            )}

            {/* Author, Date & Share Row */}
            <div className="mt-5 pb-5 border-b border-ink-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              {/* Author & Meta */}
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-900 text-white font-bold text-xs shadow-sm">
                  {article.authorName ? article.authorName.charAt(0).toUpperCase() : "A"}
                </div>
                <div className="text-xs text-ink-600">
                  <p className="font-bold text-ink-900">
                    By{" "}
                    {article.authorSlug ? (
                      <Link href={`/author/${article.authorSlug}`} className="hover:underline">
                        {article.authorName}
                      </Link>
                    ) : (
                      article.authorName
                    )}
                  </p>
                  <p className="text-[11px] text-ink-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                    <time dateTime={article.publishedAt || undefined}>{formatDate(article.publishedAt)}</time>
                    <span>•</span>
                    <span>{article.readingTimeMinutes || 1} min read</span>
                    {article.updatedAt && formatDate(article.updatedAt) !== formatDate(article.publishedAt) && (
                      <>
                        <span>•</span>
                        <span>Updated {formatDate(article.updatedAt)}</span>
                      </>
                    )}
                  </p>
                </div>
              </div>

              {/* Share icons */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-[10px] font-black uppercase tracking-wider text-ink-400 mr-1">SHARE</span>
                <button
                  type="button"
                  onClick={shareOnFacebook}
                  aria-label="Share on Facebook"
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-ink-200 text-ink-600 hover:bg-ink-100 hover:text-blue-600 transition-all font-bold text-xs"
                >
                  f
                </button>
                <button
                  type="button"
                  onClick={shareOnTwitter}
                  aria-label="Share on X"
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-ink-200 text-ink-600 hover:bg-ink-100 hover:text-black transition-all font-bold text-xs"
                >
                  𝕏
                </button>
                <button
                  type="button"
                  onClick={shareOnPinterest}
                  aria-label="Share on Pinterest"
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-ink-200 text-ink-600 hover:bg-ink-100 hover:text-signal transition-all font-bold text-xs"
                >
                  p
                </button>
                <button
                  type="button"
                  onClick={shareByEmail}
                  aria-label="Share via Email"
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-ink-200 text-ink-600 hover:bg-ink-100 transition-all"
                >
                  ✉
                </button>
                <button
                  type="button"
                  onClick={copyToClipboard}
                  className="ml-1 rounded border border-ink-200 bg-ink-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-ink-700 hover:bg-ink-100 transition-all"
                >
                  {copied ? "COPIED!" : "COPY LINK"}
                </button>
              </div>
            </div>

            {/* Featured Image — shown at its real uploaded aspect ratio, not
                cropped into a fixed 16:9 box. A plain <img> (not next/image's
                `fill`) is used deliberately: `fill` requires a box with a
                predetermined aspect ratio to size against, which is exactly
                the forced crop this is avoiding — we don't store the
                image's real width/height to size a non-fill next/image
                against instead. */}
            {article.image && (
              <figure className="mt-6">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={article.image}
                  alt={article.imageAlt || article.title}
                  className="w-full h-auto rounded-2xl shadow-sm"
                />
                {/* Credit the licence requires (or the AI-image note); the alt
                    text is for screen readers, not a caption. */}
                <PhotoCredit info={photoCredit} className="mt-2 text-xs text-ink-500" />
              </figure>
            )}

            {/* Article Body Content */}
            <div className="mt-8 article-content text-ink-800 text-sm sm:text-[15px] leading-relaxed">
              <div
                className="article-body"
                dangerouslySetInnerHTML={{ __html: article.contentHtml }}
              />
            </div>

            {series.length > 0 && (
              <section className="mt-10 rounded-xl border border-ink-200 p-5" aria-labelledby="series-heading">
                <h2 id="series-heading" className="text-xs font-bold uppercase tracking-[0.14em] text-ink-500">More on this topic</h2>
                <ul className="mt-3 space-y-2 text-sm">
                  {series.map((s) => (
                    <li key={s.url}>
                      <Link href={s.url} className="font-semibold text-ink-900 underline decoration-ink-300 underline-offset-2 hover:decoration-ink-700">
                        {s.title}
                      </Link>
                      {s.pillar && <span className="ml-2 text-xs text-ink-500">Main guide</span>}
                    </li>
                  ))}
                </ul>
              </section>
            )}


            {article.faq?.length > 0 && (
              <section className="mt-12 -mx-4 rounded-3xl bg-paper-50 px-4 py-10 sm:-mx-6 sm:px-8" aria-labelledby="faq-heading">
                <p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-[#2F80C9]">Got questions?</p>
                <h2 id="faq-heading" className="mt-2 text-center text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">
                  {faqHeading(article.focusKeyword)}
                </h2>
                <div className="mt-8 space-y-3">
                  {article.faq.map((f, i) => (
                    <details key={i} className="group rounded-2xl border border-ink-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-5 text-base font-medium text-ink-900 sm:px-6 [&::-webkit-details-marker]:hidden">
                        <span>{f.q}</span>
                        <span
                          aria-hidden
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-100 text-lg leading-none text-ink-700 transition-transform group-open:rotate-45"
                        >
                          +
                        </span>
                      </summary>
                      <p className="px-5 pb-5 text-[15px] leading-relaxed text-ink-700 sm:px-6">{f.a}</p>
                    </details>
                  ))}
                </div>
              </section>
            )}

            {/* Bottom Share Bar */}
            <div className="mt-12 pt-6 border-t border-ink-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <span className="text-xs font-black uppercase tracking-wider text-ink-700">
                SHARE THIS ARTICLE
              </span>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={shareOnFacebook}
                  aria-label="Share on Facebook"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-ink-200 text-ink-700 hover:bg-ink-100 font-bold"
                >
                  f
                </button>
                <button
                  type="button"
                  onClick={shareOnTwitter}
                  aria-label="Share on X"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-ink-200 text-ink-700 hover:bg-ink-100 font-bold"
                >
                  𝕏
                </button>
                <button
                  type="button"
                  onClick={shareOnPinterest}
                  aria-label="Share on Pinterest"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-ink-200 text-ink-700 hover:bg-ink-100 font-bold"
                >
                  p
                </button>
                <button
                  type="button"
                  onClick={shareByEmail}
                  aria-label="Share via Email"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-ink-200 text-ink-700 hover:bg-ink-100"
                >
                  ✉
                </button>
                <button
                  type="button"
                  onClick={copyToClipboard}
                  className="ml-2 rounded border border-ink-200 bg-ink-50 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-ink-700 hover:bg-ink-100"
                >
                  {copied ? "COPIED!" : "COPY LINK"}
                </button>
              </div>
            </div>
          </div>

          {/* =========================================
              3. RIGHT SIDEBAR (32% / 4 cols)
          ========================================= */}
          <ArticleSidebar
            related={relatedStories.map(toSidebarItem)}
            trending={trendingStories.map(toSidebarItem)}
          />
        </div>
      </Container>
    </div>
  );
}

// "arno boat tour" -> "Arno Boat Tour FAQs"; long or missing keywords get a
// plain heading so it never reads like "Is An Arno Boat Tour Worth It FAQs".
const SMALL_WORDS = new Set(["a", "an", "and", "at", "by", "for", "in", "of", "on", "or", "the", "to", "vs"]);
function faqHeading(keyword: string | undefined): string {
  const words = String(keyword || "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 4 || /\?$/.test(keyword || "")) return "Frequently Asked Questions";
  const title = words
    .map((w, i) => (i > 0 && SMALL_WORDS.has(w.toLowerCase()) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
  return `${title} FAQs`;
}

function toSidebarItem(a: ArticleWithRelations): SidebarItem {
  return {
    id: a.id,
    title: a.title,
    href: publicPath(a),
    image: a.image,
    eyebrow: a.cityName || a.categoryName || "",
    date: a.publishedAt,
    readingMinutes: a.readingTimeMinutes || 1,
  };
}
