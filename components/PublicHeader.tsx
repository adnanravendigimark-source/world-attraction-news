"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "./Logo";
import Container from "./Container";
import SearchForm from "./SearchForm";
import { cityPath } from "@/lib/destinations";

type CityLink = { slug: string; name: string; countrySlug?: string };
type CategoryLink = { slug: string; name: string };

// Which top-level section a path belongs to, for the active link.
export function activeSection(pathname: string): string {
  if (pathname === "/news" || pathname.startsWith("/news/")) return "news";
  if (pathname.startsWith("/latest-news")) return "guides";
  if (pathname.startsWith("/destinations")) return "destinations";
  if (pathname.startsWith("/categories")) return "topics";
  if (pathname.startsWith("/about")) return "about";
  return "";
}

const Chevron = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 20 20" className={`h-3.5 w-3.5 fill-current ${className}`} aria-hidden="true">
    <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" />
  </svg>
);

const SearchIcon = ({ className = "h-[18px] w-[18px]" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <circle cx="11" cy="11" r="7" />
    <path strokeLinecap="round" d="m21 21-4.3-4.3" />
  </svg>
);

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`relative inline-flex items-center gap-1 py-2 text-[15px] font-medium transition-colors ${
        active ? "text-ink-950" : "text-ink-600 hover:text-ink-950"
      }`}
    >
      {children}
      {active && <span className="absolute -bottom-px left-0 h-0.5 w-full rounded-full bg-signal" aria-hidden="true" />}
    </Link>
  );
}

// A link with a panel that opens on hover or when a link inside gets
// keyboard focus (focus-within), so it works without a mouse too.
function NavMenu({
  label,
  href,
  active,
  allLabel,
  emptyLabel,
  items,
  columns = 1,
}: {
  label: string;
  href: string;
  active: boolean;
  allLabel: string;
  emptyLabel: string;
  items: { href: string; name: string }[];
  columns?: 1 | 2;
}) {
  return (
    <div className="group relative">
      <NavLink href={href} active={active}>
        {label}
        <Chevron className="text-ink-400 transition-transform group-hover:rotate-180 group-focus-within:rotate-180" />
      </NavLink>
      <div className="invisible absolute left-1/2 top-full z-50 -translate-x-1/2 pt-3 opacity-0 transition duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
        <div className={`${columns === 2 ? "w-[22rem]" : "w-56"} rounded-xl border border-ink-100 bg-white p-2 shadow-dropdown`}>
          {items.length === 0 ? (
            <p className="px-3 py-2 text-sm text-ink-500">{emptyLabel}</p>
          ) : (
            <ul className={columns === 2 ? "grid grid-cols-2 gap-0.5" : "space-y-0.5"}>
              {items.map((item) => (
                <li key={item.href + item.name}>
                  <Link
                    href={item.href}
                    className="block rounded-lg px-3 py-2 text-sm text-ink-700 transition-colors hover:bg-paper-muted hover:text-ink-950 focus-visible:bg-paper-muted"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-1 border-t border-ink-100 pt-1">
            <Link
              href={href}
              className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold text-ink-900 hover:bg-paper-muted"
            >
              {allLabel}
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PublicHeader({
  cities = [],
  categories = [],
}: {
  // Admin-curated lists from Admin -> Header (see app/(public)/layout.tsx),
  // in the order and count an admin picked.
  cities?: CityLink[];
  categories?: CategoryLink[];
}) {
  const pathname = usePathname() || "/";
  const section = activeSection(pathname);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const cityItems = cities.map((c) => ({ name: c.name, href: c.countrySlug ? cityPath(c.countrySlug, c.slug) : "/destinations" }));
  const topicItems = categories.map((c) => ({ name: c.name, href: `/categories/${c.slug}` }));

  // Slimmer header with a shadow once the page is scrolled.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the menu and search after navigating.
  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  // Escape closes; the page behind the mobile menu does not scroll.
  useEffect(() => {
    if (!menuOpen && !searchOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setSearchOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    if (menuOpen) document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [menuOpen, searchOpen]);

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-ink-950 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to content
      </a>
      <header
        className={`sticky top-0 z-50 border-b bg-white transition-shadow ${
          scrolled || menuOpen ? "border-ink-100 shadow-subtle" : "border-transparent"
        }`}
      >
        <Container
          className={`flex items-center justify-between gap-6 transition-[height] duration-200 ${
            scrolled ? "h-[60px]" : "h-[60px] lg:h-[72px]"
          }`}
        >
          <Link href="/" className="flex shrink-0 items-center" aria-label="World Attraction News, home">
            <Logo variant="compact" />
          </Link>

          <nav aria-label="Main" className="hidden items-center gap-8 lg:flex">
            <NavLink href="/news" active={section === "news"}>News</NavLink>
            <NavLink href="/latest-news" active={section === "guides"}>Guides</NavLink>
            <NavMenu
              label="Destinations"
              href="/destinations"
              active={section === "destinations"}
              allLabel="All destinations"
              emptyLabel="No destinations yet."
              items={cityItems}
              columns={cityItems.length > 5 ? 2 : 1}
            />
            <NavMenu
              label="Topics"
              href="/categories"
              active={section === "topics"}
              allLabel="All topics"
              emptyLabel="No topics yet."
              items={topicItems}
            />
            <NavLink href="/about" active={section === "about"}>About</NavLink>
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSearchOpen((v) => !v);
                setMenuOpen(false);
              }}
              aria-label={searchOpen ? "Close search" : "Search"}
              aria-expanded={searchOpen}
              className={`flex h-10 items-center gap-2 rounded-full px-3 text-sm font-medium transition-colors ${
                searchOpen ? "bg-ink-950 text-white" : "text-ink-700 hover:bg-paper-muted hover:text-ink-950"
              }`}
            >
              <SearchIcon />
              <span className="hidden xl:inline">Search</span>
            </button>
            <Link
              href="/write-for-us"
              className="hidden rounded-full border border-ink-200 px-4 py-2 text-sm font-semibold text-ink-900 transition-colors hover:border-ink-900 lg:inline-flex"
            >
              Write for us
            </Link>
            <button
              type="button"
              onClick={() => {
                setMenuOpen((v) => !v);
                setSearchOpen(false);
              }}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              className="flex h-10 w-10 items-center justify-center rounded-full text-ink-900 hover:bg-paper-muted lg:hidden"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                {menuOpen ? <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" /> : <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />}
              </svg>
            </button>
          </div>
        </Container>

        {searchOpen && (
          <div className="border-t border-ink-100 bg-white animate-fade-in-up">
            <Container className="py-4">
              <SearchForm autoFocus className="mx-auto max-w-2xl" placeholder="Search news, guides and destinations…" />
            </Container>
          </div>
        )}

        {menuOpen && (
          <nav
            id="mobile-menu"
            aria-label="Main"
            className="fixed inset-x-0 bottom-0 top-[60px] z-40 overflow-y-auto border-t border-ink-100 bg-white lg:hidden animate-fade-in-up"
          >
            <Container className="flex min-h-full flex-col py-5">
              <SearchForm placeholder="Search news, guides and destinations…" />
              <ul className="mt-4 divide-y divide-ink-100">
                {[
                  { href: "/news", label: "News", key: "news" },
                  { href: "/latest-news", label: "Guides", key: "guides" },
                  { href: "/destinations", label: "Destinations", key: "destinations" },
                  { href: "/categories", label: "Topics", key: "topics" },
                  { href: "/about", label: "About", key: "about" },
                ].map((item) => (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      aria-current={section === item.key ? "page" : undefined}
                      className={`flex items-center justify-between py-3.5 font-serif text-[22px] ${
                        section === item.key ? "text-ink-950" : "text-ink-800"
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        {section === item.key && <span className="h-1.5 w-1.5 rounded-full bg-signal" aria-hidden="true" />}
                        {item.label}
                      </span>
                      <span className="text-base text-ink-300" aria-hidden="true">→</span>
                    </Link>
                  </li>
                ))}
              </ul>

              {cityItems.length > 0 && (
                <div className="mt-6">
                  <p className="text-xs font-semibold uppercase tracking-widest text-ink-500">Popular destinations</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {cityItems.map((c) => (
                      <Link
                        key={c.href + c.name}
                        href={c.href}
                        className="rounded-full border border-ink-200 px-3.5 py-1.5 text-sm text-ink-800 hover:border-ink-900"
                      >
                        {c.name}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-auto flex flex-col gap-2 pt-8">
                <Link
                  href="/write-for-us"
                  className="rounded-full bg-ink-950 py-3 text-center text-sm font-semibold text-white"
                >
                  Write for us
                </Link>
                <Link href="/login" className="py-2 text-center text-sm text-ink-500 hover:text-ink-900">
                  Contributor login
                </Link>
              </div>
            </Container>
          </nav>
        )}
      </header>
    </>
  );
}
