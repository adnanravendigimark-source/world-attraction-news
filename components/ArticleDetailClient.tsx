"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Container from "@/components/Container";
import type { ArticleWithRelations } from "@/lib/articles";
import { cityPath, articlePath } from "@/lib/destinations";

export default function ArticleDetailClient({
  article,
  relatedStories = [],
  trendingStories = [],
}: {
  article: ArticleWithRelations;
  relatedStories?: ArticleWithRelations[];
  trendingStories?: ArticleWithRelations[];
}) {
  const [copied, setCopied] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [subscribeError, setSubscribeError] = useState("");
  const [sidebarEmail, setSidebarEmail] = useState("");
  const [sidebarCompany, setSidebarCompany] = useState(""); // honeypot

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

  const formatViews = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
    return String(n);
  };

  const displayTrending = trendingStories.slice(0, 5);
  const displayRelated = relatedStories.slice(0, 4);

  async function handleSubscribe(e: React.FormEvent) {
    e.preventDefault();
    setSubscribing(true);
    setSubscribeError("");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: sidebarEmail, company: sidebarCompany, source: "article_sidebar" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setSubscribed(true);
    } catch (err) {
      setSubscribeError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubscribing(false);
    }
  }

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
            Latest News
          </Link>
          <span>&gt;</span>
          <Link href={cityPath(article.countrySlug, article.citySlug)} className="hover:text-slate-900 transition-colors">
            {article.cityName}
          </Link>
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
              <span className="text-[#DC2626]">{article.cityName?.toUpperCase()}</span>
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
                    <span className="inline-flex items-center gap-1 font-medium text-slate-700 bg-slate-100/80 border border-slate-200/60 px-2 py-0.5 rounded-full">
                      <svg className="w-3 h-3 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      {formatViews(article.viewCount || 0)} views
                    </span>
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

            {/* Featured Image */}
            <div className="mt-6">
              <div className="relative w-full aspect-[16/9] rounded-2xl overflow-hidden bg-slate-900 shadow-sm">
                {article.image && (
                  <Image
                    src={article.image}
                    alt={article.imageAlt || article.title}
                    fill
                    priority
                    sizes="(min-width: 1024px) 65vw, 100vw"
                    className="object-cover"
                  />
                )}
              </div>
              {article.imageAlt && (
                <p className="mt-2 text-[11px] text-slate-400 italic text-center">{article.imageAlt}</p>
              )}
            </div>

            {/* Article Body Content */}
            <div className="mt-8 article-content text-slate-800 text-sm sm:text-[15px] leading-relaxed">
              <div
                className="prose prose-slate max-w-none prose-headings:font-serif prose-headings:font-black prose-headings:text-[#0B1527] prose-p:leading-relaxed prose-a:text-[#DC2626] prose-a:font-semibold"
                dangerouslySetInnerHTML={{ __html: article.contentHtml }}
              />
            </div>

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
          <div className="lg:col-span-4 flex flex-col gap-6">
            {/* Never Miss an Update Card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-sans text-sm font-black text-[#0B1527]">
                  Never Miss an Update
                </h3>
                <span className="text-xl">✉️</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed mb-4">
                Subscribe to get the latest attraction news, opening dates, and updates straight to your inbox.
              </p>

              {subscribed ? (
                <div className="p-3 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg text-center">
                  ✓ You&apos;re subscribed to our dispatch wire!
                </div>
              ) : (
                <form onSubmit={handleSubscribe} className="flex flex-col gap-2.5">
                  <input
                    type="text"
                    value={sidebarCompany}
                    onChange={(e) => setSidebarCompany(e.target.value)}
                    className="hidden"
                    tabIndex={-1}
                    autoComplete="off"
                    aria-hidden="true"
                  />
                  <input
                    type="email"
                    required
                    value={sidebarEmail}
                    onChange={(e) => setSidebarEmail(e.target.value)}
                    placeholder="Enter your email address"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#DC2626] focus:bg-white focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={subscribing}
                    className="w-full rounded-lg bg-[#DC2626] py-2.5 text-xs font-black uppercase tracking-wider text-white hover:bg-[#B91C1C] transition-colors shadow-sm disabled:opacity-60"
                  >
                    {subscribing ? "SUBSCRIBING…" : "SUBSCRIBE"}
                  </button>
                  {subscribeError && (
                    <p className="text-[10px] text-[#DC2626] text-center">{subscribeError}</p>
                  )}
                  <p className="text-[10px] text-slate-400 text-center">
                    No spam. Unsubscribe anytime.
                  </p>
                </form>
              )}
            </div>

            {/* Related Stories Card */}
            {displayRelated.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
                <h3 className="font-sans text-xs sm:text-sm font-black uppercase tracking-wider text-[#0B1527] mb-4 pb-2 border-b border-slate-100">
                  Related Stories
                </h3>
                <div className="flex flex-col gap-4">
                  {displayRelated.map((item) => (
                    <Link
                      key={item.id}
                      href={articlePath(item.countrySlug, item.citySlug, item.slug)}
                      className="group flex items-start gap-3"
                    >
                      <div className="relative h-14 w-14 sm:h-16 sm:w-16 shrink-0 rounded-lg overflow-hidden bg-slate-100">
                        {item.image && (
                          <Image
                            src={item.image}
                            alt={item.title}
                            fill
                            sizes="64px"
                            className="object-cover group-hover:scale-105 transition-transform"
                          />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-[#DC2626] block">
                          {item.cityName || item.categoryName}
                        </span>
                        <h4 className="font-sans text-xs font-bold text-[#0B1527] line-clamp-2 leading-snug group-hover:text-[#DC2626] transition-colors mt-0.5">
                          {item.title}
                        </h4>
                        <p className="text-[10px] text-slate-400 mt-1">
                          {formatDate(item.publishedAt)} • {item.readingTimeMinutes || 1} min read
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Trending Now Card */}
            {displayTrending.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
                <div className="flex items-center gap-1.5 mb-4 pb-2 border-b border-slate-100">
                  <span className="text-xs">📈</span>
                  <h3 className="font-sans text-xs sm:text-sm font-black uppercase tracking-wider text-[#0B1527]">
                    Trending Now
                  </h3>
                </div>

                <div className="flex flex-col gap-3.5">
                  {displayTrending.map((item, idx) => (
                    <Link
                      key={item.id}
                      href={articlePath(item.countrySlug, item.citySlug, item.slug)}
                      className="group flex items-center gap-3"
                    >
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0B1527] text-[10px] font-black text-white">
                        {idx + 1}
                      </span>
                      <div className="relative h-11 w-11 shrink-0 rounded-md overflow-hidden bg-slate-100">
                        {item.image && (
                          <Image
                            src={item.image}
                            alt={item.title}
                            fill
                            sizes="44px"
                            className="object-cover group-hover:scale-105 transition-transform"
                          />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-sans text-xs font-bold text-[#0B1527] line-clamp-1 leading-snug group-hover:text-[#DC2626] transition-colors">
                          {item.title}
                        </h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {formatDate(item.publishedAt)}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Have News to Share? Dark Box */}
            <div className="relative overflow-hidden rounded-2xl bg-[#0B1527] text-white p-6 shadow-md flex flex-col gap-3">
              <div className="absolute right-2 -bottom-2 opacity-15 pointer-events-none">
                <svg className="w-24 h-24 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </div>

              <h3 className="font-serif text-lg font-black text-white">
                Have News to Share?
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed max-w-[260px]">
                Submit your attraction news, updates, or opening announcements.
              </p>
              <Link
                href="/write-for-us"
                className="mt-2 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#DC2626] py-2.5 px-4 text-xs font-black uppercase tracking-wider text-white hover:bg-[#B91C1C] transition-colors shadow-sm self-start"
              >
                <span>SUBMIT YOUR NEWS</span>
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}
