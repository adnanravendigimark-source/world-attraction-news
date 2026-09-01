"use client";

import { useState } from "react";
import Link from "next/link";
import Logo from "./Logo";
import Container from "./Container";
import SearchForm from "./SearchForm";
import { SITE_NAME } from "@/lib/site";

const NAV_LINKS = [
  { href: "/latest-news", label: "Latest News" },
  { href: "/cities", label: "Cities" },
  { href: "/categories", label: "Categories" },
  { href: "/write-for-us", label: "Write for Us" },
];

export default function PublicHeader() {
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b-2 border-ink-900 bg-paper/95 backdrop-blur-sm">
      <div className="bg-ink-900 py-1.5 text-center text-[11px] font-semibold tracking-wide text-paper">
        Independent, contributor-written attraction news — not affiliated with any park or venue.
      </div>
      <Container className="flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex shrink-0 items-center gap-2.5" onClick={() => setOpen(false)}>
          <Logo className="h-8 w-8 shrink-0" />
          <span className="font-serif text-lg font-bold tracking-tight text-ink-900 sm:text-xl">{SITE_NAME}</span>
        </Link>

        <nav className="hidden lg:flex lg:flex-1 lg:items-center lg:justify-center lg:gap-6">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-[13px] font-semibold uppercase tracking-wide text-ink-600 transition-colors hover:text-signal"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden shrink-0 items-center gap-3 lg:flex">
          {searchOpen ? (
            <SearchForm autoFocus className="w-64" />
          ) : (
            <button
              type="button"
              aria-label="Open search"
              onClick={() => setSearchOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-md text-ink-600 hover:bg-ink-50 hover:text-signal"
            >
              <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <path strokeLinecap="round" d="m21 21-4.3-4.3" />
              </svg>
            </button>
          )}
          <span className="h-4 w-px bg-ink-200" aria-hidden="true" />
          <Link
            href="/signup"
            className="whitespace-nowrap rounded-md bg-signal px-3.5 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-signal-dark"
          >
            Become a Contributor
          </Link>
        </div>

        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-ink-200 text-ink-700 hover:bg-ink-50 lg:hidden"
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
      </Container>

      {open && (
        <nav className="border-t border-ink-200 bg-paper lg:hidden">
          <Container className="flex flex-col divide-y divide-ink-100 py-2">
            <div className="py-3">
              <SearchForm autoFocus />
            </div>
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="py-3 text-sm font-semibold uppercase tracking-wide text-ink-800"
              >
                {l.label}
              </Link>
            ))}
            <Link href="/signup" onClick={() => setOpen(false)} className="py-3 text-sm font-semibold text-signal">
              Become a Contributor →
            </Link>
            <Link href="/login" onClick={() => setOpen(false)} className="py-3 text-sm font-medium text-ink-600">
              Contributor Login
            </Link>
          </Container>
        </nav>
      )}
    </header>
  );
}
