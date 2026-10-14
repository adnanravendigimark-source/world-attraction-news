"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import Container from "@/components/Container";

export interface HeroSlide {
  id: string;
  eyebrow?: string;
  title: string;
  excerpt: string;
  author?: string;
  date: string;
  readTime: string;
  image: string;
  imageAlt?: string;
  href: string;
}

// Slides come from published articles (see app/(public)/page.tsx): what an
// editor marked Featured, else the newest guides. With none, nothing renders.
export default function HomeHeroCarousel({ slides = [] }: { slides?: HeroSlide[] }) {
  const stories = slides;
  const [activeIdx, setActiveIdx] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const nextStory = useCallback(() => {
    setActiveIdx((prev) => (prev + 1) % stories.length);
  }, [stories.length]);

  const prevStory = useCallback(() => {
    setActiveIdx((prev) => (prev - 1 + stories.length) % stories.length);
  }, [stories.length]);

  // Slower 12s auto-switch timer, pauses when hovered
  useEffect(() => {
    if (isHovered || stories.length <= 1) return;
    const interval = setInterval(nextStory, 12000);
    return () => clearInterval(interval);
  }, [isHovered, nextStory, stories.length]);

  const current = stories[activeIdx] || stories[0];
  if (!current) return null;

  return (
    <div
      className="relative w-full h-[calc(100vh-104px)] lg:h-[calc(100vh-116px)] min-h-[460px] max-h-[720px] overflow-hidden bg-ink-950 group select-none"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Full-width edge-to-edge background image */}
      <div className="absolute inset-0">
        <Image
          key={current.id || current.image}
          src={current.image}
          alt={current.imageAlt || current.title}
          fill
          priority
          sizes="100vw"
          className="object-cover object-center transition-transform duration-700 group-hover:scale-101"
        />
      </div>

      {/* Dark Vignette: Left side heavily darkened for typography, right sunset side vivid & clear */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/45 via-55% to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent pointer-events-none" />

      {/* Aligned Content Container */}
      <Container className="relative z-10 flex h-full flex-col justify-center">
        <div className="max-w-xl sm:max-w-2xl py-6 sm:py-8">
          {/* FEATURED badge */}
          <div className="mb-3.5 sm:mb-4">
            <span className="inline-block rounded-full bg-signal px-3.5 py-1 text-[10.5px] sm:text-[11px] font-black uppercase tracking-wider text-white shadow-sm">
              {current.eyebrow || "FEATURED"}
            </span>
          </div>

          {/* Headline (3-line wrap in serif) */}
          <h1 className="font-serif text-2xl sm:text-3xl md:text-4xl lg:text-[44px] xl:text-[48px] font-bold leading-[1.14] text-white drop-shadow-sm max-w-lg sm:max-w-xl">
            <Link href={current.href} className="hover:underline decoration-white/40">
              {current.title}
            </Link>
          </h1>

          {/* Excerpt */}
          <p className="mt-3.5 sm:mt-4 text-xs sm:text-sm md:text-[15px] leading-relaxed text-gray-200/90 max-w-lg line-clamp-3">
            {current.excerpt}
          </p>

          {/* Meta line: Calendar + Date + 4 min read */}
          <div className="mt-4 sm:mt-5 flex items-center gap-2 text-xs sm:text-sm text-gray-300 font-normal">
            <svg className="h-4 w-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span>{current.date}</span>
            <span className="text-gray-400 mx-1">•</span>
            <span>{current.readTime}</span>
          </div>

          {/* Read Full Story Button */}
          <div className="mt-6 sm:mt-7">
            <Link
              href={current.href}
              className="inline-flex items-center gap-2 rounded-full bg-white px-5 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold text-ink-950 shadow-md transition-all hover:bg-gray-100 hover:scale-102 active:scale-98"
            >
              <span>Read Full Story</span>
              <span aria-hidden="true" className="font-bold">→</span>
            </Link>
          </div>
        </div>

        {/* Carousel Controls (Bottom Right aligned with Container) */}
        {stories.length > 1 && (
          <div className="absolute bottom-5 sm:bottom-7 right-3.5 sm:right-6 lg:right-8 z-20 flex items-center gap-2.5">
            {/* Left Button: White Circle */}
            <button
              type="button"
              onClick={prevStory}
              aria-label="Previous Story"
              className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-white text-ink-950 shadow-md transition-all hover:bg-gray-100 active:scale-95 cursor-pointer"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {/* Right Button: Dark Circle with White Arrow */}
            <button
              type="button"
              onClick={nextStory}
              aria-label="Next Story"
              className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-black/60 text-white border border-white/20 backdrop-blur-sm shadow-md transition-all hover:bg-black/80 active:scale-95 cursor-pointer"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {/* Counter */}
            <span className="text-xs sm:text-sm font-medium tracking-wide text-white drop-shadow ml-1.5">
              {activeIdx + 1} / {stories.length}
            </span>
          </div>
        )}
      </Container>
    </div>
  );
}
