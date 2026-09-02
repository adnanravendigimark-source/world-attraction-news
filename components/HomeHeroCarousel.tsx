"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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

const DEFAULT_NEWS_STORIES: HeroSlide[] = [
  {
    id: "epic-universe",
    eyebrow: "ORLANDO BUREAU",
    cityName: "ORLANDO",
    categoryName: "NEW ATTRACTIONS",
    title: "Epic Universe Opens at Universal Orlando Resort: Everything You Need to Know",
    excerpt:
      "Universal Orlando Resort opens its most ambitious theme park expansion in over two decades. Explore Celestial Park, Super Nintendo World, Dark Universe, and expert visitor strategies.",
    author: "Marcus Vance",
    date: "May 14, 2025",
    readTime: "4 min read",
    image: "/images/epic-universe.jpg",
    imageAlt: "Universal Epic Universe Celestial Park Entrance Arch",
    href: "/latest-news/epic-universe-opens-universal-orlando",
  },
  {
    id: "disneyland-paris",
    eyebrow: "PARIS BUREAU",
    cityName: "PARIS",
    categoryName: "EVENTS & FESTIVALS",
    title: "Disneyland Paris Announces New Nighttime Show for Summer 2025",
    excerpt:
      "A brand-new state-of-the-art drone, projection, and fireworks extravaganza takes over Sleeping Beauty Castle with 800 synchronized drones.",
    author: "Camille Laurent",
    date: "May 13, 2025",
    readTime: "3 min read",
    image: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=800&q=80",
    imageAlt: "Disneyland Paris Castle Night Spectacle",
    href: "/latest-news/disneyland-paris-new-night-show-summer",
  },
  {
    id: "universal-coaster",
    eyebrow: "ORLANDO BUREAU",
    cityName: "ORLANDO",
    categoryName: "THEME PARKS",
    title: "Universal Studios Unveils First Look at New Fast & Furious Coaster",
    excerpt:
      "The groundbreaking high-speed outdoor coaster features revolutionary 360-degree drifting ride vehicles and magnetic launch technology.",
    author: "Marcus Vance",
    date: "May 13, 2025",
    readTime: "3 min read",
    image: "https://images.unsplash.com/photo-1513889961551-628c1e5e2ee9?auto=format&fit=crop&w=800&q=80",
    imageAlt: "Universal Studios Roller Coaster Track",
    href: "/latest-news/universal-studios-hollywood-fast-and-furious-coaster",
  },
  {
    id: "amsterdam-museums",
    eyebrow: "AMSTERDAM BUREAU",
    cityName: "AMSTERDAM",
    categoryName: "MUSEUMS & CULTURE",
    title: "Amsterdam Landmark Attractions & Opening Calendar: Complete Visitor Guide",
    excerpt:
      "Explore the newest expansions, ticket advice, and on-the-ground news across Amsterdam's top cultural and canal-side landmarks.",
    author: "Saskia de Boer",
    date: "May 13, 2025",
    readTime: "4 min read",
    image: "https://images.unsplash.com/photo-1534351590666-13e3e96b5017?auto=format&fit=crop&w=800&q=80",
    imageAlt: "Amsterdam Canals and Rijksmuseum",
    href: "/latest-news/amsterdam-landmark-attraction-updates-guide",
  },
  {
    id: "london-eye-nye",
    eyebrow: "LONDON BUREAU",
    cityName: "LONDON",
    categoryName: "EVENTS & FESTIVALS",
    title: "New Year's Eve Fireworks on the Thames: What to Know Near the London Eye",
    excerpt:
      "London's official New Year's Eve fireworks are launched from the London Eye and River Thames barges — here's how to view the show.",
    author: "Eleanor Sterling",
    date: "May 13, 2025",
    readTime: "3 min read",
    image: "/images/london-eye-fireworks.jpg",
    imageAlt: "Fireworks over the Thames near the London Eye during New Year's Eve celebrations.",
    href: "/latest-news/new-years-eve-fireworks-on-the-thames-what-to-know-near-london-eye",
  },
];

const TRENDING_TOPICS = [
  { label: "Universal Epic Universe", href: "/latest-news/epic-universe-opens-universal-orlando" },
  { label: "Disneyland Paris Drone Show", href: "/latest-news/disneyland-paris-new-night-show-summer" },
  { label: "Tokyo DisneySea Fantasy Springs", href: "/latest-news/tokyo-disneysea-fantasy-springs-expansion" },
  { label: "London Eye NYE", href: "/latest-news/new-years-eve-fireworks-on-the-thames-what-to-know-near-london-eye" },
  { label: "Sagrada Familia Milestone", href: "/latest-news/sagrada-familia-completion-timeline-revealed" },
];

export default function HomeHeroCarousel({ slides }: { slides?: HeroSlide[] }) {
  const stories = slides && slides.length >= 5 ? slides.slice(0, 5) : DEFAULT_NEWS_STORIES;
  const [activeIdx, setActiveIdx] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const nextStory = useCallback(() => {
    setActiveIdx((prev) => (prev + 1) % stories.length);
  }, [stories.length]);

  const prevStory = useCallback(() => {
    setActiveIdx((prev) => (prev - 1 + stories.length) % stories.length);
  }, [stories.length]);

  // Continuous Auto-Switch Timer (every 3 seconds)
  useEffect(() => {
    if (isHovered || stories.length <= 1) return;
    const interval = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % stories.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [isHovered, stories.length, activeIdx]);

  const currentStory = stories[activeIdx] || stories[0];

  return (
    <section
      className="border-b border-slate-200 bg-white pt-2.5 pb-4 sm:pt-3 sm:pb-5"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* =========================================
          1. TOP LIVE WIRE TICKER
      ========================================= */}
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
            {TRENDING_TOPICS.map((topic, i) => (
              <Link
                key={i}
                href={topic.href}
                className="whitespace-nowrap font-bold text-slate-700 hover:text-[#DC2626] transition-colors shrink-0 text-[11px] sm:text-xs"
              >
                {topic.label} {i < TRENDING_TOPICS.length - 1 && <span className="text-slate-300 ml-3">•</span>}
              </Link>
            ))}
          </div>
        </div>
      </Container>

      {/* =========================================
          2. MAIN HERO & 5-STORY WIRE (PERFECT NO SCROLL FIT)
      ========================================= */}
      <Container>
        <div className="grid gap-4 lg:gap-5 lg:grid-cols-12 items-stretch">
          {/* Left Column: Big Lead Story (63% / 7.5 cols) */}
          <article className="lg:col-span-7 xl:col-span-8 flex flex-col justify-between group rounded-2xl border border-slate-200/90 bg-white overflow-hidden shadow-2xs hover:shadow-xs transition-all p-3.5 sm:p-4 relative">
            <div>
              {/* Lead Image Container with Floating < > Buttons */}
              <div className="relative block w-full h-48 sm:h-64 md:h-72 lg:h-[280px] xl:h-[305px] rounded-xl overflow-hidden bg-slate-100 mb-3 group/img">
                <Link href={currentStory.href} className="block w-full h-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    key={currentStory.id}
                    src={currentStory.image}
                    alt={currentStory.imageAlt || currentStory.title}
                    className="h-full w-full object-cover group-hover/img:scale-102 transition-transform duration-500"
                  />
                </Link>

                {/* Bureau / Live Badge */}
                <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-[#DC2626] text-white px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-widest shadow-md pointer-events-none">
                  <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                  <span>{currentStory.eyebrow || "TOP STORY"}</span>
                </div>

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
                  <p className="text-[10px] text-slate-500">{currentStory.date} • {currentStory.readTime}</p>
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

          {/* Right Column: 5 Top Stories Wire with Auto Switcher (37% / 4.5 cols) */}
          <div className="lg:col-span-5 xl:col-span-4 flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-4 shadow-2xs">
            <div>
              {/* Box Header with Live indicator & < > controls */}
              <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#DC2626] animate-pulse" />
                  <h2 className="font-sans text-xs sm:text-[13px] font-black uppercase tracking-wider text-[#0B1527]">
                    TOP STORIES TODAY
                  </h2>
                </div>

                {/* Toolbar controls: < > and counter */}
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

              {/* 5 Stories Stack with Active Selection Highlight */}
              <div className="flex flex-col divide-y divide-slate-100">
                {stories.map((story, idx) => {
                  const isActive = idx === activeIdx;

                  return (
                    <button
                      key={story.id || idx}
                      type="button"
                      onClick={() => setActiveIdx(idx)}
                      className={`text-left py-2 first:pt-1 last:pb-1 group transition-all rounded-lg px-2 -mx-1 cursor-pointer ${isActive
                          ? "bg-rose-50/70 border-l-3 border-[#DC2626]"
                          : "hover:bg-slate-50"
                        }`}
                    >
                      <div className="flex items-center gap-2.5">
                        {/* Thumbnail */}
                        <div className="relative h-12 w-16 sm:h-13 sm:w-18 shrink-0 rounded-md overflow-hidden bg-slate-100">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={story.image}
                            alt={story.imageAlt || story.title}
                            className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                          />
                        </div>

                        {/* Title & Tag */}
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
                            {story.date} • {story.readTime}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bottom News Wire Link */}
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
        </div>
      </Container>
    </section>
  );
}
