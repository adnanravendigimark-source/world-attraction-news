"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "./Logo";
import Container from "./Container";
import SearchForm from "./SearchForm";

export default function PublicHeader({
  cities = [],
  categories = [],
}: {
  cities?: { slug: string; name: string }[];
  categories?: { slug: string; name: string }[];
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [currentDateStr, setCurrentDateStr] = useState("Wednesday, May 14, 2025");
  const [destDropdownOpen, setDestDropdownOpen] = useState(false);
  const [catDropdownOpen, setCatDropdownOpen] = useState(false);

  const displayCities = cities.length > 0 ? cities : [
    { slug: "orlando", name: "Orlando" },
    { slug: "paris", name: "Paris" },
    { slug: "tokyo", name: "Tokyo" },
    { slug: "singapore", name: "Singapore" },
    { slug: "dubai", name: "Dubai" },
    { slug: "london", name: "London" },
  ];

  const displayCategories = categories.length > 0 ? categories : [
    { slug: "theme-parks", name: "Theme Parks" },
    { slug: "water-parks", name: "Water Parks" },
    { slug: "zoos-and-aquariums", name: "Zoos & Aquariums" },
    { slug: "museums", name: "Museums & Culture" },
    { slug: "landmarks", name: "Iconic Landmarks" },
  ];

  useEffect(() => {
    try {
      const now = new Date();
      setCurrentDateStr(
        now.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      );
    } catch {
      setCurrentDateStr("Wednesday, May 14, 2025");
    }
  }, []);

  const isHome = pathname === "/";

  return (
    <header className="sticky top-0 z-50 bg-white shadow-sm">
      {/* Top Dark Bar with Live Ticker */}
      <div className="bg-[#0B1320] px-4 py-1.5 text-white border-b border-slate-800">
        <Container className="flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="inline-flex items-center gap-1 rounded bg-[#DC2626] px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white">
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                LIVE
              </span>
              <span className="font-bold uppercase tracking-wider text-slate-200 hidden xs:inline">
                LIVE UPDATES
              </span>
            </div>
            <span className="text-slate-600 hidden sm:inline" aria-hidden="true">|</span>
            <Link
              href="/cities/paris/disneyland-paris-new-nighttime-show"
              className="text-slate-300 hover:text-white truncate transition-colors font-medium hover:underline"
            >
              Disneyland Paris unveils new night time spectacular
            </Link>
          </div>

          <div className="flex items-center gap-4 shrink-0 pl-2 text-slate-300">
            <span className="hidden md:inline font-medium text-slate-400 text-[11px]">
              {currentDateStr}
            </span>
            <Link
              href="/login"
              className="text-slate-300 hover:text-white transition-colors text-[11px] font-semibold"
            >
              Contributor Login
            </Link>
          </div>
        </Container>
      </div>

      {/* Main Navigation Bar */}
      <div className="border-b border-slate-200/80 bg-white">
        <Container className="flex h-18 items-center justify-between gap-4 py-2.5">
          {/* Logo */}
          <Link href="/" className="shrink-0 flex items-center group" onClick={() => setOpen(false)}>
            <Logo variant="horizontal" showTagline className="h-9 w-auto" />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex lg:items-center lg:gap-7">
            <Link
              href="/"
              className={`relative py-2 text-[12px] font-extrabold uppercase tracking-wider transition-colors ${
                pathname === "/"
                  ? "text-[#DC2626]"
                  : "text-slate-800 hover:text-[#DC2626]"
              }`}
            >
              HOME
              {pathname === "/" && (
                <span className="absolute bottom-0 left-0 h-[2.5px] w-full rounded-full bg-[#DC2626]" />
              )}
            </Link>

            <Link
              href="/latest-news"
              className={`relative py-2 text-[12px] font-extrabold uppercase tracking-wider transition-colors ${
                pathname.startsWith("/latest-news")
                  ? "text-[#DC2626]"
                  : "text-slate-800 hover:text-[#DC2626]"
              }`}
            >
              LATEST NEWS
              {pathname.startsWith("/latest-news") && (
                <span className="absolute bottom-0 left-0 h-[2.5px] w-full rounded-full bg-[#DC2626]" />
              )}
            </Link>

            {/* Destinations Dropdown */}
            <div
              className="relative"
              onMouseEnter={() => setDestDropdownOpen(true)}
              onMouseLeave={() => setDestDropdownOpen(false)}
            >
              <Link
                href="/cities"
                className={`flex items-center gap-1 py-2 text-[12px] font-extrabold uppercase tracking-wider transition-colors ${
                  pathname.startsWith("/cities")
                    ? "text-[#DC2626]"
                    : "text-slate-800 hover:text-[#DC2626]"
                }`}
              >
                <span>DESTINATIONS</span>
                <svg className="h-3 w-3 fill-current text-slate-500" viewBox="0 0 20 20">
                  <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                </svg>
              </Link>
              {destDropdownOpen && (
                <div className="absolute left-0 top-full w-48 rounded-lg border border-slate-200 bg-white py-2 shadow-xl animate-fade-in-up z-50">
                  {displayCities.map((c) => (
                    <Link
                      key={c.slug}
                      href={`/cities/${c.slug}`}
                      className="block px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-[#DC2626]"
                    >
                      {c.name}
                    </Link>
                  ))}
                  <div className="border-t border-slate-100 mt-1 pt-1">
                    <Link
                      href="/cities"
                      className="block px-4 py-1.5 text-xs font-bold text-[#DC2626] hover:underline"
                    >
                      View All Destinations →
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Categories Dropdown */}
            <div
              className="relative"
              onMouseEnter={() => setCatDropdownOpen(true)}
              onMouseLeave={() => setCatDropdownOpen(false)}
            >
              <Link
                href="/categories"
                className={`flex items-center gap-1 py-2 text-[12px] font-extrabold uppercase tracking-wider transition-colors ${
                  pathname.startsWith("/categories")
                    ? "text-[#DC2626]"
                    : "text-slate-800 hover:text-[#DC2626]"
                }`}
              >
                <span>CATEGORIES</span>
                <svg className="h-3 w-3 fill-current text-slate-500" viewBox="0 0 20 20">
                  <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                </svg>
              </Link>
              {catDropdownOpen && (
                <div className="absolute left-0 top-full w-52 rounded-lg border border-slate-200 bg-white py-2 shadow-xl animate-fade-in-up z-50">
                  {displayCategories.map((c) => (
                    <Link
                      key={c.slug}
                      href={`/categories/${c.slug}`}
                      className="block px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-[#DC2626]"
                    >
                      {c.name}
                    </Link>
                  ))}
                  <div className="border-t border-slate-100 mt-1 pt-1">
                    <Link
                      href="/categories"
                      className="block px-4 py-1.5 text-xs font-bold text-[#DC2626] hover:underline"
                    >
                      View All Categories →
                    </Link>
                  </div>
                </div>
              )}
            </div>

            <Link
              href="/about"
              className={`relative py-2 text-[12px] font-extrabold uppercase tracking-wider transition-colors ${
                pathname.startsWith("/about")
                  ? "text-[#DC2626]"
                  : "text-slate-800 hover:text-[#DC2626]"
              }`}
            >
              ABOUT US
              {pathname.startsWith("/about") && (
                <span className="absolute bottom-0 left-0 h-[2.5px] w-full rounded-full bg-[#DC2626]" />
              )}
            </Link>
          </nav>

          {/* Right Action Bar */}
          <div className="hidden shrink-0 items-center gap-3.5 lg:flex">
            {searchOpen ? (
              <div className="flex items-center gap-2">
                <SearchForm autoFocus className="w-60" />
                <button
                  type="button"
                  onClick={() => setSearchOpen(false)}
                  className="text-xs font-bold text-slate-400 hover:text-slate-900 p-1"
                  aria-label="Close search"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                type="button"
                aria-label="Search"
                onClick={() => setSearchOpen(true)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:border-slate-400 hover:text-[#DC2626] transition-all"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <circle cx="11" cy="11" r="7" />
                  <path strokeLinecap="round" d="m21 21-4.3-4.3" />
                </svg>
              </button>
            )}

            <Link
              href="/write-for-us"
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md bg-[#DC2626] px-5 py-2.5 text-[11px] font-extrabold uppercase tracking-wider text-white shadow hover:bg-[#B91C1C] transition-all"
            >
              WRITE FOR US
            </Link>
          </div>

          {/* Mobile Hamburger */}
          <div className="flex items-center gap-2 lg:hidden">
            <button
              type="button"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
            >
              {open ? (
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
                </svg>
              )}
            </button>
          </div>
        </Container>
      </div>

      {/* Mobile drawer */}
      {open && (
        <nav className="border-t border-slate-200 bg-white px-4 py-4 lg:hidden animate-fade-in-up">
          <Container className="flex flex-col gap-3">
            <div className="pb-3 border-b border-slate-100">
              <SearchForm autoFocus />
            </div>
            <Link
              href="/"
              onClick={() => setOpen(false)}
              className={`py-2 text-xs font-bold uppercase tracking-wider ${
                pathname === "/" ? "text-[#DC2626]" : "text-slate-800 hover:text-[#DC2626]"
              }`}
            >
              HOME
            </Link>
            <Link
              href="/latest-news"
              onClick={() => setOpen(false)}
              className={`py-2 text-xs font-bold uppercase tracking-wider ${
                pathname.startsWith("/latest-news") ? "text-[#DC2626]" : "text-slate-800 hover:text-[#DC2626]"
              }`}
            >
              LATEST NEWS
            </Link>
            <Link
              href="/cities"
              onClick={() => setOpen(false)}
              className={`py-2 text-xs font-bold uppercase tracking-wider ${
                pathname.startsWith("/cities") ? "text-[#DC2626]" : "text-slate-800 hover:text-[#DC2626]"
              }`}
            >
              DESTINATIONS
            </Link>
            <Link
              href="/categories"
              onClick={() => setOpen(false)}
              className={`py-2 text-xs font-bold uppercase tracking-wider ${
                pathname.startsWith("/categories") ? "text-[#DC2626]" : "text-slate-800 hover:text-[#DC2626]"
              }`}
            >
              CATEGORIES
            </Link>
            <Link
              href="/about"
              onClick={() => setOpen(false)}
              className={`py-2 text-xs font-bold uppercase tracking-wider ${
                pathname.startsWith("/about") ? "text-[#DC2626]" : "text-slate-800 hover:text-[#DC2626]"
              }`}
            >
              ABOUT US
            </Link>
            <div className="pt-3 border-t border-slate-200 flex flex-col gap-2">
              <Link
                href="/write-for-us"
                onClick={() => setOpen(false)}
                className="flex items-center justify-center rounded-md bg-[#DC2626] py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow"
              >
                WRITE FOR US
              </Link>
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="text-center py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                Contributor Login
              </Link>
            </div>
          </Container>
        </nav>
      )}
    </header>
  );
}
