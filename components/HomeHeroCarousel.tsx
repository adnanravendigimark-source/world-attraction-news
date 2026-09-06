"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import Container from "@/components/Container";

export interface HeroSlide {
  id: string;
  eyebrow: string;
  title: string;
  excerpt: string;
  author: string;
  date: string;
  readTime: string;
  image: string;
  imageAlt?: string;
  href: string;
  cityName?: string;
  categoryName?: string;
}

export interface TickerItem {
  label: string;
  href: string;
}

// Real data only — both `slides` and `tickerItems` come from the homepage's
// own published-article queries (see app/(public)/page.tsx). When there
// isn't enough real content yet (a brand-new site, or nothing published),
// this renders an honest empty state instead of ever inventing stories.
export default function HomeHeroCarousel({
  slides,
  tickerItems,
}: {
  slides?: HeroSlide[];
  tickerItems?: TickerItem[];
}) {
  const stories = slides ? slides.slice(0, 5) : [];
  const [activeIdx, setActiveIdx] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const nextStory = useCallback(() => {
    setActiveIdx((prev) => (prev + 1) % stories.length);
  }, [stories.length]);

  const prevStory = useCallback(() => {
    setActiveIdx((prev) => (prev - 1 + stories.length) % stories.length);
  }, [stories.length]);

  // Continuous Auto-Switch Timer (every 5 seconds) — only runs when there's
  // more than one real story to rotate through.
  useEffect(() => {
    if (isHovered || stories.length <= 1) return;
    const interval = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % stories.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [isHovered, stories.length]);

  const currentStory = stories[activeIdx] || stories[0];
  const hasMultiple = stories.length > 1;

  return (
    <section
      className="border-b border-slate-200 bg-white pt-2.5 pb-4 sm:pt-3 sm:pb-5"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* =========================================
          1. TOP LIVE WIRE TICKER (real breaking/trending headlines only)
      ========================================= */}
      {tickerItems && tickerItems.length > 0 && (
        <Container className="mb-2.5 sm:mb-3">
          <div className="flex items-center gap-2 sm:gap-3 rounded-lg bg-slate-50 border border-slate-200/80 px-2.5 py-1 overflow-hidden">
            <div className="flex items-center gap-1.5 shrink-0 bg-white border border-slate-200 px-2 py-0.5 rounded shadow-2xs">
              <span className="h-2 w-2 rounded-full bg-[#DC2626] animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-wider text-[#DC2626]">
                LIVE WIRE
              </span>
            </div>
            <div className="flex items-center gap-3 overflow-x-auto no-scrollbar text-xs">
              <span className="text-slate-400 font-bold shrink-0 hidden sm:inline">TRENDING:</span>
              {tickerItems.map((topic, i) => (
                <Link
                  key={topic.href}
                  href={topic.href}
                  className="whitespace-nowrap font-bold text-slate-700 hover:text-[#DC2626] transition-colors shrink-0 text-[11px] sm:text-xs"
                >
                  {topic.label} {i < tickerItems.length - 1 && <span className="text-slate-300 ml-3">•</span>}
                </Link>
              ))}
            </div>
          </div>
        </Container>
      )}

      {/* =========================================
          2. MAIN HERO & TOP-STORIES WIRE
      ========================================= */}
      <Container>
        {stories.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-14 text-center">
            <h1 className="font-serif text-xl sm:text-2xl font-black text-[#0B1527]">
              No stories published yet
            </h1>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-500 leading-relaxed">
              Check back soon for the latest theme park and attraction news from around the world.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 lg:gap-5 lg:grid-cols-12 items-stretch">
            {/* Left Column: Big Lead Story */}
            <article
              className={`flex flex-col justify-between group rounded-2xl border border-slate-200/90 bg-white overflow-hidden shadow-2xs hover:shadow-xs transition-all p-3.5 sm:p-4 relative ${hasMultiple ? "lg:col-span-7 xl:col-span-8" : "lg:col-span-12"
                }`}
            >
              <div>
                {/* Lead Image Container with Floating < > Buttons */}
                <div className="relative block w-full h-48 sm:h-64 md:h-72 lg:h-[280px] xl:h-[305px] rounded-xl overflow-hidden bg-slate-100 mb-3 group/img">
                  <Link href={currentStory.href} className="block w-full h-full">
                    <Image
                      key={currentStory.id}
                      src={currentStory.image}
                      alt={currentStory.imageAlt || currentStory.title}
                      fill
                      priority
                      sizes={hasMultiple ? "(min-width: 1024px) 55vw, 100vw" : "(min-width: 1024px) 80vw, 100vw"}
                      className="object-cover group-hover/img:scale-102 transition-transform duration-500"
                    />
                  </Link>

                  {/* Bureau / Live Badge */}
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-[#DC2626] text-white px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-widest shadow-md pointer-events-none">
                    <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                    <span>{currentStory.eyebrow || "TOP STORY"}</span>
                  </div>

                  {hasMultiple && (
                    <>
                      {/* Left Switch Button (<) */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          prevStory();
                        }}
                        aria-label="Previous News Story"
                        className="absolute left-3 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/65 text-white backdrop-blur-md hover:bg-[#DC2626] hover:scale-105 transition-all shadow-md z-20 cursor-pointer"
                      >
                        <svg className="h-4 w-4 fill-none stroke-current" viewBox="0 0 24 24" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>

                      {/* Right Switch Button (>) */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          nextStory();
                        }}
                        aria-label="Next News Story"
                        className="absolute right-3 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/65 text-white backdrop-blur-md hover:bg-[#DC2626] hover:scale-105 transition-all shadow-md z-20 cursor-pointer"
                      >
                        <svg className="h-4 w-4 fill-none stroke-current" viewBox="0 0 24 24" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </button>

                      {/* Bottom Story Index Indicators */}
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full z-20">
                        {stories.map((_, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              setActiveIdx(i);
                            }}
                            aria-label={`Jump to story ${i + 1}`}
                            className={`h-1.5 rounded-full transition-all cursor-pointer ${i === activeIdx ? "w-4 bg-[#DC2626]" : "w-1.5 bg-white/60 hover:bg-white"
                              }`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Eyebrow */}
                <div className="flex items-center gap-2 text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-[#DC2626] mb-1">
                  <span>{currentStory.cityName || "GLOBAL"} BUREAU</span>
                  <span className="text-slate-300">•</span>
                  <span className="text-slate-500">{currentStory.categoryName || "ATTRACTION NEWS"}</span>
                </div>

                {/* Title */}
                <h1 className="font-serif text-xl sm:text-2xl lg:text-[25px] xl:text-[27px] font-black leading-snug sm:leading-tight text-[#0B1527] group-hover:text-[#DC2626] transition-colors line-clamp-2">
                  <Link href={currentStory.href}>{currentStory.title}</Link>
                </h1>

                {/* Excerpt */}
                <p className="mt-1.5 text-xs sm:text-[13.5px] leading-relaxed text-slate-600 font-medium line-clamp-2">
                  {currentStory.excerpt}
                </p>
              </div>

              {/* Bottom Row */}
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <div className="h-6 w-6 rounded-full bg-[#0B1527] text-white flex items-center justify-center font-bold text-[9px]">
                    AN
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 text-[11px]">By {currentStory.author}</p>
                    <p className="text-[10px] text-slate-500">
                      {currentStory.date}
                      {currentStory.date && currentStory.readTime && " • "}
                      {currentStory.readTime}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href={currentStory.href}
                    className="inline-flex items-center gap-1 rounded-md bg-[#DC2626] px-3.5 py-1.5 text-[11px] font-black uppercase tracking-wider text-white shadow-2xs hover:bg-[#B91C1C] transition-colors"
                  >
                    <span>READ FULL STORY</span>
                    <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </div>
            </article>

            {/* Right Column: Top Stories Wire — only when there's more than one real story */}
            {hasMultiple && (
              <div className="lg:col-span-5 xl:col-span-4 flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-4 shadow-2xs">
                <div>
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-[#DC2626] animate-pulse" />
                      <h2 className="font-sans text-xs sm:text-[13px] font-black uppercase tracking-wider text-[#0B1527]">
                        TOP STORIES TODAY
                      </h2>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono font-bold text-slate-400">
                        {activeIdx + 1}/{stories.length}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={prevStory}
                          aria-label="Previous Story"
                          className="flex h-5 w-5 items-center justify-center rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer text-xs font-bold"
                        >
                          ‹
                        </button>
                        <button
                          type="button"
                          onClick={nextStory}
                          aria-label="Next Story"
                          className="flex h-5 w-5 items-center justify-center rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer text-xs font-bold"
                        >
                          ›
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col divide-y divide-slate-100">
                    {stories.map((story, idx) => {
                      const isActive = idx === activeIdx;
                      return (
                        <button
                          key={story.id || idx}
                          type="button"
                          onClick={() => setActiveIdx(idx)}
                          className={`text-left py-2 first:pt-1 last:pb-1 group transition-all rounded-lg px-2 -mx-1 cursor-pointer ${isActive ? "bg-rose-50/70 border-l-3 border-[#DC2626]" : "hover:bg-slate-50"
                            }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="relative h-12 w-16 sm:h-13 sm:w-18 shrink-0 rounded-md overflow-hidden bg-slate-100">
                              <Image
                                src={story.image}
                                alt={story.imageAlt || story.title}
                                fill
                                sizes="80px"
                                className="object-cover group-hover:scale-105 transition-transform"
                              />
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-[#DC2626] mb-0.5">
                                <span>{story.cityName || story.eyebrow}</span>
                                {isActive && (
                                  <span className="ml-auto inline-block h-1.5 w-1.5 rounded-full bg-[#DC2626] animate-pulse" />
                                )}
                              </div>
                              <h3
                                className={`font-sans text-[11px] sm:text-xs font-bold leading-snug line-clamp-2 transition-colors ${isActive ? "text-[#DC2626]" : "text-[#0B1527] group-hover:text-[#DC2626]"
                                  }`}
                              >
                                {story.title}
                              </h3>
                              <p className="text-[9px] text-slate-400 font-medium">
                                {story.date}
                                {story.date && story.readTime && " • "}
                                {story.readTime}
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-2 pt-2 border-t border-slate-100">
                  <Link
                    href="/latest-news"
                    className="text-[11px] font-black uppercase tracking-wider text-[#DC2626] hover:underline flex items-center justify-between group"
                  >
                    <span>VIEW FULL NEWS WIRE</span>
                    <span className="group-hover:translate-x-0.5 transition-transform">→</span>
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </Container>
    </section>
  );
}
