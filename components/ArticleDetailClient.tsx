"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import Container from "@/components/Container";
import ArticleSidebar, { type SidebarItem } from "@/components/ArticleSidebar";
import { publicPath } from "@/lib/content/paths";
import type { ArticleWithRelations } from "@/lib/articles";
import { cityPath, countryPath, articlePath } from "@/lib/destinations";

export default function ArticleDetailClient({
  article,
  relatedStories = [],
  trendingStories = [],
  sources = [],
  series = [],
}: {
  article: ArticleWithRelations;
  relatedStories?: ArticleWithRelations[];
  trendingStories?: ArticleWithRelations[];
  sources?: { n: number; title: string; url: string; publisher: string }[];
  // Published articles from the same topic cluster, main guide first.
  series?: { title: string; url: string; pillar: boolean }[];
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!article.id) return;
    fetch(`/api/articles/${article.id}/view`, { method: "POST" })
      .catch((err) => console.error("[ArticleDetailClient] view tracking error:", err));
  }, [article.id]);

  const fullUrl =
    typeof window !== "undefined"
      ? window.location.href
      : `https://worldattractionnews.com${articlePath(article.countrySlug, article.citySlug, article.slug)}`;

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
    window.location.href = `mailto:?subject=${encodeURIComponent(article.title)}&body=${encodeURIComponent(`Check out this story on Attraction News: ${fullUrl}`)}`;
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };




  return (
    <div className="bg-white min-h-screen text-[#0B1527] pb-20">
      <Container className="pt-5 sm:pt-6">
        {/* =========================================
            1. BREADCRUMBS
        ========================================= */}
        <nav className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-slate-400 mb-5">
          <Link href="/" className="hover:text-slate-900 transition-colors">
            Home
          </Link>
          <span>&gt;</span>
          <Link href="/latest-news" className="hover:text-slate-900 transition-colors">
            Blog
          </Link>
          <span>&gt;</span>
          {article.citySlug ? (
            <Link href={cityPath(article.countrySlug, article.citySlug)} className="hover:text-slate-900 transition-colors">
              {article.cityName}
            </Link>
          ) : (
            <Link href={countryPath(article.countrySlug)} className="hover:text-slate-900 transition-colors">
              {article.countryName || article.countrySlug}
            </Link>
          )}
          <span>&gt;</span>
          <span className="text-slate-800 line-clamp-1 max-w-[280px] sm:max-w-md">{article.title}</span>
        </nav>

        {/* =========================================
            2. MAIN ARTICLE & SIDEBAR LAYOUT
        ========================================= */}
        <div className="grid gap-10 lg:grid-cols-12 items-start">
          {/* Main Article Content (68% / 8 cols) */}
          <div className="lg:col-span-8 flex flex-col">
            {/* Eyebrow */}
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider mb-2.5">
              <span className="text-[#DC2626]">{(article.cityName || article.countryName || "")?.toUpperCase()}</span>
              {article.categoryName && (
                <>
                  <span className="text-slate-300">|</span>
                  <span className="text-slate-500">{article.categoryName.toUpperCase()}</span>
                </>
              )}
            </div>

            {/* Headline */}
            <h1 className="font-serif text-3xl sm:text-4xl lg:text-[42px] font-black tracking-tight text-[#0B1527] leading-[1.15]">
              {article.title}
            </h1>

            {/* Subtitle / Excerpt */}
            {article.excerpt && (
              <p className="mt-3 text-sm sm:text-base text-slate-600 italic leading-relaxed font-serif">
                {article.excerpt}
              </p>
            )}

            {/* Author, Date & Share Row */}
            <div className="mt-5 pb-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              {/* Author & Meta */}
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0B1527] text-white font-bold text-xs shadow-sm">
                  {article.authorName ? article.authorName.charAt(0).toUpperCase() : "A"}
                </div>
                <div className="text-xs text-slate-600">
                  <p className="font-bold text-[#0B1527]">
                    By {article.authorName}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                    <span>{formatDate(article.publishedAt)}</span>
                    <span>•</span>
                    <span>{article.readingTimeMinutes || 1} min read</span>
                    <span>•</span>
                    <span>Updated {formatDate(article.updatedAt || article.publishedAt)}</span>
                  </p>
                </div>
              </div>

              {/* Share icons */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 mr-1">SHARE</span>
                <button
                  type="button"
                  onClick={shareOnFacebook}
                  aria-label="Share on Facebook"
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-blue-600 transition-all font-bold text-xs"
                >
                  f
                </button>
                <button
                  type="button"
                  onClick={shareOnTwitter}
                  aria-label="Share on X"
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-black transition-all font-bold text-xs"
                >
                  𝕏
                </button>
                <button
                  type="button"
                  onClick={shareOnPinterest}
                  aria-label="Share on Pinterest"
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-red-600 transition-all font-bold text-xs"
                >
                  p
                </button>
                <button
                  type="button"
                  onClick={shareByEmail}
                  aria-label="Share via Email"
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:bg-slate-100 transition-all"
                >
                  ✉
                </button>
                <button
                  type="button"
                  onClick={copyToClipboard}
                  className="ml-1 rounded border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-700 hover:bg-slate-100 transition-all"
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
              <div className="mt-6">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={article.image}
                  alt={article.imageAlt || article.title}
                  className="w-full h-auto rounded-2xl shadow-sm"
                />
              </div>
            )}
            {article.image && article.imageAlt && (
              <p className="mt-2 text-[11px] text-slate-400 italic text-center">{article.imageAlt}</p>
            )}

            {/* Article Body Content */}
            <div className="mt-8 article-content text-slate-800 text-sm sm:text-[15px] leading-relaxed">
              <div
                className="rich-content article-body"
                dangerouslySetInnerHTML={{ __html: article.contentHtml }}
              />
            </div>

            {series.length > 0 && (
              <section className="mt-10 rounded-xl border border-slate-200 p-5" aria-labelledby="series-heading">
                <h2 id="series-heading" className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">More on this topic</h2>
                <ul className="mt-3 space-y-2 text-sm">
                  {series.map((s) => (
                    <li key={s.url}>
                      <Link href={s.url} className="font-semibold text-slate-900 underline decoration-slate-300 underline-offset-2 hover:decoration-slate-700">
                        {s.title}
                      </Link>
                      {s.pillar && <span className="ml-2 text-xs text-slate-500">Main guide</span>}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {sources.length > 0 && (
              <section className="mt-10 rounded-xl bg-slate-50 p-5" aria-labelledby="sources-heading">
                <h2 id="sources-heading" className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Sources</h2>
                <p className="mt-2 text-xs text-slate-500">
                  Facts in this guide were checked against these sources. Last updated{" "}
                  {new Date(article.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}. Prices, opening hours and entry rules can change: check the official site before you go.
                </p>
                <ul className="mt-3 space-y-1.5 text-sm">
                  {sources.map((s) => (
                    <li key={s.n}>
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-slate-800 underline decoration-slate-300 underline-offset-2 hover:decoration-slate-700">
                        {s.publisher ? `${s.publisher}: ` : ""}{s.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {article.faq?.length > 0 && (
              <section className="mt-12 -mx-4 rounded-3xl bg-[#F8F8F7] px-4 py-10 sm:-mx-6 sm:px-8" aria-labelledby="faq-heading">
                <p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-[#2F80C9]">Got questions?</p>
                <h2 id="faq-heading" className="mt-2 text-center text-2xl font-bold tracking-tight text-[#0B1527] sm:text-3xl">
                  {faqHeading(article.focusKeyword)}
                </h2>
                <div className="mt-8 space-y-3">
                  {article.faq.map((f, i) => (
                    <details key={i} className="group rounded-2xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-5 text-base font-medium text-[#0B1527] sm:px-6 [&::-webkit-details-marker]:hidden">
                        <span>{f.q}</span>
                        <span
                          aria-hidden
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-lg leading-none text-slate-700 transition-transform group-open:rotate-45"
                        >
                          +
                        </span>
                      </summary>
                      <p className="px-5 pb-5 text-[15px] leading-relaxed text-slate-700 sm:px-6">{f.a}</p>
                    </details>
                  ))}
                </div>
              </section>
            )}

            {/* Bottom Share Bar */}
            <div className="mt-12 pt-6 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                SHARE THIS ARTICLE
              </span>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={shareOnFacebook}
                  aria-label="Share on Facebook"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold"
                >
                  f
                </button>
                <button
                  type="button"
                  onClick={shareOnTwitter}
                  aria-label="Share on X"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold"
                >
                  𝕏
                </button>
                <button
                  type="button"
                  onClick={shareOnPinterest}
                  aria-label="Share on Pinterest"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold"
                >
                  p
                </button>
                <button
                  type="button"
                  onClick={shareByEmail}
                  aria-label="Share via Email"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-700 hover:bg-slate-100"
                >
                  ✉
                </button>
                <button
                  type="button"
                  onClick={copyToClipboard}
                  className="ml-2 rounded border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-slate-700 hover:bg-slate-100"
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
