"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Container from "@/components/Container";
import type { ArticleWithRelations } from "@/lib/articles";

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
  const [sidebarEmail, setSidebarEmail] = useState("");

  const fullUrl = typeof window !== "undefined" ? window.location.href : `https://attractionnews.com/latest-news/${article.slug}`;

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
    if (!iso) return "May 13, 2025";
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  // Default fallback trending if db has fewer items
  const displayTrending = trendingStories.length > 0 ? trendingStories.slice(0, 5) : [
    {
      id: "trend-1",
      slug: "epic-universe-opens-universal-orlando",
      title: "Epic Universe Opens at Universal Orlando Resort",
      publishedAt: "2025-05-10T12:00:00Z",
      image: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=300&q=80",
    },
    {
      id: "trend-2",
      slug: "disneyland-paris-new-night-show-summer",
      title: "Disneyland Paris Announces New Night Show for Summer 2025",
      publishedAt: "2025-05-09T12:00:00Z",
      image: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=300&q=80",
    },
    {
      id: "trend-3",
      slug: "seaworld-orlando-adds-new-aquarium-experience",
      title: "SeaWorld Orlando Adds New Aquarium Experience",
      publishedAt: "2025-05-12T12:00:00Z",
      image: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=300&q=80",
    },
    {
      id: "trend-4",
      slug: "tokyo-disneysea-fantasy-springs-expansion",
      title: "Tokyo DisneySea Fantasy Springs Expansion Opens June 6",
      publishedAt: "2025-05-08T12:00:00Z",
      image: "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=300&q=80",
    },
    {
      id: "trend-5",
      slug: "sagrada-familia-completion-timeline-revealed",
      title: "Sagrada Familia Completion Timeline Revealed",
      publishedAt: "2025-05-09T12:00:00Z",
      image: "https://images.unsplash.com/photo-1583422409516-2895a77efded?auto=format&fit=crop&w=300&q=80",
    },
  ];

  // Default fallback related if db has fewer items
  const displayRelated = relatedStories.length > 0 ? relatedStories.slice(0, 4) : [
    {
      id: "rel-1",
      slug: "london-eye-ticket-types-and-best-time-to-go",
      title: "London Eye: Ticket Types and the Best Time of Day to Go",
      cityName: "LONDON",
      categoryName: "VISITOR TIPS",
      publishedAt: "2025-05-11T12:00:00Z",
      readingTimeMinutes: 4,
      image: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=300&q=80",
    },
    {
      id: "rel-2",
      slug: "bastille-day-fireworks-eiffel-tower-what-to-know",
      title: "Bastille Day Fireworks at the Eiffel Tower: What to Know",
      cityName: "PARIS",
      categoryName: "EVENTS & FESTIVALS",
      publishedAt: "2025-05-10T12:00:00Z",
      readingTimeMinutes: 3,
      image: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=300&q=80",
    },
    {
      id: "rel-3",
      slug: "new-ticket-options-universal-orlando-resort",
      title: "New Ticket Options Announced for Universal Orlando Resort",
      cityName: "ORLANDO",
      categoryName: "TICKETS & PRICING",
      publishedAt: "2025-05-09T12:00:00Z",
      readingTimeMinutes: 2,
      image: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=300&q=80",
    },
    {
      id: "rel-4",
      slug: "best-places-to-watch-fireworks-around-the-world",
      title: "Best Places to Watch Fireworks Around the World",
      cityName: "GLOBAL",
      categoryName: "VISITOR TIPS",
      publishedAt: "2025-05-07T12:00:00Z",
      readingTimeMinutes: 5,
      image: "https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=300&q=80",
    },
  ];

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
          <Link href={`/cities/${article.citySlug || "london"}`} className="hover:text-slate-900 transition-colors">
            {article.cityName || "London"}
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
              <span className="text-[#DC2626]">{article.cityName?.toUpperCase() || "LONDON"}</span>
              <span className="text-slate-300">|</span>
              <span className="text-slate-500">{article.categoryName?.toUpperCase() || "EVENTS & FESTIVALS"}</span>
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
                    By {article.authorName || "London Launch Editorial Team"}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {formatDate(article.publishedAt)} • {article.readingTimeMinutes || 3} min read • Updated {formatDate(article.updatedAt || article.publishedAt)}
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
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={article.image || "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=1600&q=85"}
                  alt={article.imageAlt || article.title}
                  className="h-full w-full object-cover"
                />
              </div>
              <p className="mt-2 text-[11px] text-slate-400 italic text-center">
                {article.imageAlt || `${article.title} coverage and on-the-ground reporting.`}
              </p>
            </div>

            {/* Article Body Content */}
            <div className="mt-8 article-content text-slate-800 text-sm sm:text-[15px] leading-relaxed">
              {article.contentHtml ? (
                <div
                  className="prose prose-slate max-w-none prose-headings:font-serif prose-headings:font-black prose-headings:text-[#0B1527] prose-p:leading-relaxed prose-a:text-[#DC2626] prose-a:font-semibold"
                  dangerouslySetInnerHTML={{ __html: article.contentHtml }}
                />
              ) : (
                <div className="space-y-6">
                  <p>
                    <span className="float-left text-5xl font-black font-serif leading-none pr-3 pt-1 text-[#0B1527]">
                      L
                    </span>
                    ondon&apos;s official New Year&apos;s Eve fireworks display is one of the most spectacular in the world. Set against the backdrop of the London Eye and the River Thames, the event draws hundreds of thousands of people to the South Bank and surrounding areas.
                  </p>
                  <p>
                    If you&apos;re planning to be near the London Eye for New Year&apos;s Eve, here&apos;s everything you need to know to make the most of the celebration.
                  </p>

                  <h2 className="font-serif text-xl sm:text-2xl font-black text-[#0B1527] mt-8 mb-3">
                    How the Fireworks Work
                  </h2>
                  <p>
                    The fireworks are launched from the London Eye and multiple barges positioned along the Thames. The show lasts about 12 minutes and is synchronized to music broadcast on local radio and across the BBC.
                  </p>

                  <h2 className="font-serif text-xl sm:text-2xl font-black text-[#0B1527] mt-8 mb-3">
                    Where You Can Watch
                  </h2>
                  <p>
                    While the South Bank is the most popular viewing area, tickets are required for entry. However, there are several vantage points further from the river where you can still enjoy great views:
                  </p>
                  <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-700">
                    <li><strong className="text-slate-900">Primrose Hill</strong> — panoramic views of the entire London skyline.</li>
                    <li><strong className="text-slate-900">Peckham Rye Park</strong> — elevated grassy vantage points.</li>
                    <li><strong className="text-slate-900">Alexandra Palace</strong> — sweeping views across North and Central London.</li>
                    <li><strong className="text-slate-900">Hampstead Heath</strong> — Parliament Hill offers unobstructed skyline sights.</li>
                  </ul>

                  <h2 className="font-serif text-xl sm:text-2xl font-black text-[#0B1527] mt-8 mb-3">
                    Tickets and Entry
                  </h2>
                  <p>
                    Access to the official riverside viewing areas is ticketed and sells out months in advance. Tickets include security checks, dedicated viewing zones, and access to amenities.
                  </p>

                  {/* Inline Ticket Callout Box */}
                  <div className="my-6 rounded-xl border border-rose-200 bg-rose-50/50 p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🎟️</span>
                      <p className="text-xs sm:text-sm font-bold text-[#0B1527]">
                        Official tickets for New Year&apos;s Eve 2025 are on sale now.
                      </p>
                    </div>
                    <Link
                      href="/calendar"
                      className="rounded-lg bg-[#DC2626] px-4 py-2 text-xs font-black uppercase tracking-wider text-white hover:bg-[#B91C1C] transition-colors shrink-0 shadow-sm"
                    >
                      VIEW TICKETS &amp; INFO
                    </Link>
                  </div>

                  <h2 className="font-serif text-xl sm:text-2xl font-black text-[#0B1527] mt-8 mb-3">
                    Plan Your Journey
                  </h2>
                  <p>
                    Expect major road closures and crowded transport. Plan ahead and allow extra time for your journey:
                  </p>
                  <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-700">
                    <li>Use public transport and check for service changes.</li>
                    <li>Arrive early to pass security and reach your viewing area.</li>
                    <li>Check weather forecasts and dress warmly.</li>
                  </ul>
                </div>
              )}
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
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setSubscribed(true);
                  }}
                  className="flex flex-col gap-2.5"
                >
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
                    className="w-full rounded-lg bg-[#DC2626] py-2.5 text-xs font-black uppercase tracking-wider text-white hover:bg-[#B91C1C] transition-colors shadow-sm"
                  >
                    SUBSCRIBE
                  </button>
                  <p className="text-[10px] text-slate-400 text-center">
                    No spam. Unsubscribe anytime.
                  </p>
                </form>
              )}
            </div>

            {/* Related Stories Card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
              <h3 className="font-sans text-xs sm:text-sm font-black uppercase tracking-wider text-[#0B1527] mb-4 pb-2 border-b border-slate-100">
                Related Stories
              </h3>
              <div className="flex flex-col gap-4">
                {displayRelated.map((item) => (
                  <Link
                    key={item.id}
                    href={`/latest-news/${item.slug}`}
                    className="group flex items-start gap-3"
                  >
                    <div className="relative h-14 w-14 sm:h-16 sm:w-16 shrink-0 rounded-lg overflow-hidden bg-slate-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.image || "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=200&q=80"}
                        alt={item.title}
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-black uppercase tracking-wider text-[#DC2626] block">
                        {item.cityName || item.categoryName || "THEME PARKS"}
                      </span>
                      <h4 className="font-sans text-xs font-bold text-[#0B1527] line-clamp-2 leading-snug group-hover:text-[#DC2626] transition-colors mt-0.5">
                        {item.title}
                      </h4>
                      <p className="text-[10px] text-slate-400 mt-1">
                        {formatDate(item.publishedAt)} • {item.readingTimeMinutes || 3} min read
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Trending Now Card */}
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
                    href={`/latest-news/${item.slug}`}
                    className="group flex items-center gap-3"
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0B1527] text-[10px] font-black text-white">
                      {idx + 1}
                    </span>
                    <div className="relative h-11 w-11 shrink-0 rounded-md overflow-hidden bg-slate-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.image || "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=200&q=80"}
                        alt={item.title}
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                      />
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
