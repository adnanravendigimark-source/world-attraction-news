import Link from "next/link";
import Logo from "./Logo";
import Container from "./Container";
import { DEFAULT_FOOTER_CONFIG, type FooterConfig } from "@/lib/settings";

export default function PublicFooter({
  footerConfig = DEFAULT_FOOTER_CONFIG,
}: {
  footerConfig?: FooterConfig;
}) {
  const currentYear = new Date().getFullYear();

  const socialLinks = [
    {
      name: "Facebook",
      href: "https://facebook.com",
      path: "M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z",
    },
    {
      name: "X",
      href: "https://x.com",
      path: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z",
    },
    {
      name: "Instagram",
      href: "https://instagram.com",
      path: "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z",
    },
    {
      name: "YouTube",
      href: "https://youtube.com",
      path: "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z",
    },
  ];

  return (
    <footer className="bg-[#0c1322] text-white pt-12 pb-8 border-t border-slate-800">
      <Container>
        {/* Top 5-Column Editorial Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-12 gap-8 lg:gap-6 pb-10">
          {/* Col 1: Brand & Bio (4 cols) */}
          <div className="lg:col-span-4">
            <Link href="/" className="inline-block" aria-label="World Attraction News">
              <Logo variant="compact" theme="light" showTagline={false} />
            </Link>
            <p className="mt-3 text-xs leading-relaxed text-slate-400 max-w-sm">
              Your trusted source for the latest news and updates from the world&apos;s top attractions and destinations.
            </p>
            <div className="mt-4 flex items-center gap-3 text-slate-300">
              {socialLinks.map((s) => (
                <a
                  key={s.name}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-colors"
                  aria-label={s.name}
                >
                  <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                    <path d={s.path} />
                  </svg>
                </a>
              ))}
            </div>
          </div>

          {/* Col 2: EXPLORE (2 cols) */}
          <div className="lg:col-span-2">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-white mb-3.5">
              EXPLORE
            </h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li>
                <Link href="/destinations" className="hover:text-white transition-colors">
                  Destinations
                </Link>
              </li>
              <li>
                <Link href="/categories/attractions" className="hover:text-white transition-colors">
                  Attractions
                </Link>
              </li>
              <li>
                <Link href="/categories" className="hover:text-white transition-colors">
                  Categories
                </Link>
              </li>
              <li>
                <Link href="/about" className="hover:text-white transition-colors">
                  About Us
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: RESOURCES (2 cols) */}
          <div className="lg:col-span-2">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-white mb-3.5">
              RESOURCES
            </h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li>
                <Link href="/write-for-us" className="hover:text-white transition-colors">
                  Write For Us
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-white transition-colors">
                  Contact Us
                </Link>
              </li>
              <li>
                <Link href="/privacy-policy" className="hover:text-white transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms-and-conditions" className="hover:text-white transition-colors">
                  Terms & Conditions
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 4: POPULAR CATEGORIES (2 cols) */}
          <div className="lg:col-span-2">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-white mb-3.5">
              POPULAR CATEGORIES
            </h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li>
                <Link href="/categories/aviation" className="hover:text-white transition-colors">
                  Aviation
                </Link>
              </li>
              <li>
                <Link href="/categories/airports" className="hover:text-white transition-colors">
                  Airports
                </Link>
              </li>
              <li>
                <Link href="/categories/travel-rules" className="hover:text-white transition-colors">
                  Travel Rules
                </Link>
              </li>
              <li>
                <Link href="/categories/destinations" className="hover:text-white transition-colors">
                  Destinations
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 5: CONTACT (2 cols) */}
          <div className="lg:col-span-2">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-white mb-3.5">
              CONTACT
            </h4>
            <a
              href="mailto:livetravelpartner@gmail.com"
              className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors break-all"
            >
              <svg className="h-4 w-4 shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span>livetravelpartner@gmail.com</span>
            </a>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-slate-800/80" />

        {/* Bottom Row */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-6 text-xs text-slate-500">
          <p>© {currentYear} World Attraction News. All rights reserved.</p>
          <div className="flex items-center gap-4 text-slate-400">
            <Link href="/privacy-policy" className="hover:text-white transition-colors">
              Privacy
            </Link>
            <Link href="/terms-and-conditions" className="hover:text-white transition-colors">
              Terms
            </Link>
            <Link href="/cookie-policy" className="hover:text-white transition-colors">
              Cookies
            </Link>
          </div>
        </div>
      </Container>
    </footer>
  );
}
