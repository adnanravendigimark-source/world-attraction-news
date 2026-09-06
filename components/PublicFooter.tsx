import Link from "next/link";
import Logo from "./Logo";
import Container from "./Container";
import { SITE_NAME, CONTACT_EMAIL } from "@/lib/site";

export default function PublicFooter({
  cities = [],
  categories = [],
}: {
  cities?: { slug: string; name: string }[];
  categories?: { slug: string; name: string }[];
}) {
  return (
    <footer className="bg-[#071120] text-slate-300 pt-14 pb-8 border-t border-slate-800">
      <Container>
        <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 pb-12 border-b border-slate-800/80">
          {/* Col 1: Logo & About */}
          <div className="lg:col-span-1">
            <Link href="/" className="inline-block">
              <Logo variant="horizontal" theme="light" showTagline className="h-9 w-auto" />
            </Link>
            <p className="mt-4 text-xs leading-relaxed text-slate-400 max-w-xs">
              Your trusted source for the latest news and updates from the world&apos;s top attractions and destinations.
            </p>
          </div>

          {/* Col 2: EXPLORE */}
          <div>
            <h3 className="font-sans text-xs font-bold uppercase tracking-wider text-white">
              EXPLORE
            </h3>
            <ul className="mt-4 space-y-2.5 text-xs">
              <li>
                <Link href="/destinations" className="text-slate-400 hover:text-white transition-colors">
                  Destinations
                </Link>
              </li>
              <li>
                <Link href="/destinations" className="text-slate-400 hover:text-white transition-colors">
                  Attractions
                </Link>
              </li>
              <li>
                <Link href="/categories" className="text-slate-400 hover:text-white transition-colors">
                  Categories
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-slate-400 hover:text-white transition-colors">
                  About Us
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: RESOURCES */}
          <div>
            <h3 className="font-sans text-xs font-bold uppercase tracking-wider text-white">
              RESOURCES
            </h3>
            <ul className="mt-4 space-y-2.5 text-xs">
              <li>
                <Link href="/write-for-us" className="text-slate-400 hover:text-white transition-colors">
                  Submit News
                </Link>
              </li>
              <li>
                <Link href="/write-for-us" className="text-slate-400 hover:text-white transition-colors">
                  Write For Us
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-slate-400 hover:text-white transition-colors">
                  Advertise
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-slate-400 hover:text-white transition-colors">
                  Contact Us
                </Link>
              </li>
              <li>
                <Link href="/privacy-policy" className="text-slate-400 hover:text-white transition-colors">
                  Privacy Policy
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 4: POPULAR CATEGORIES */}
          <div>
            <h3 className="font-sans text-xs font-bold uppercase tracking-wider text-white">
              POPULAR CATEGORIES
            </h3>
            <ul className="mt-4 space-y-2.5 text-xs">
              <li>
                <Link href="/categories/theme-parks" className="text-slate-400 hover:text-white transition-colors">
                  Theme Parks
                </Link>
              </li>
              <li>
                <Link href="/categories/water-parks" className="text-slate-400 hover:text-white transition-colors">
                  Water Parks
                </Link>
              </li>
              <li>
                <Link href="/categories/zoos-and-aquariums" className="text-slate-400 hover:text-white transition-colors">
                  Zoos &amp; Aquariums
                </Link>
              </li>
              <li>
                <Link href="/categories/museums" className="text-slate-400 hover:text-white transition-colors">
                  Museums
                </Link>
              </li>
              <li>
                <Link href="/categories/landmarks" className="text-slate-400 hover:text-white transition-colors">
                  Landmarks
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 5: CONTACT & SOCIAL */}
          <div>
            <h3 className="font-sans text-xs font-bold uppercase tracking-wider text-white">
              CONTACT
            </h3>
            <div className="mt-4">
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors"
              >
                <svg className="h-4 w-4 shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="truncate">{CONTACT_EMAIL}</span>
              </a>

              <div className="mt-5 flex items-center gap-2.5">
                {/* Facebook */}
                <a
                  href="https://facebook.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-8 w-8 items-center justify-center rounded bg-slate-800 text-slate-300 hover:bg-[#1877F2] hover:text-white transition-colors"
                  aria-label="Facebook"
                >
                  <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                    <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
                  </svg>
                </a>
                {/* X / Twitter */}
                <a
                  href="https://x.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-8 w-8 items-center justify-center rounded bg-slate-800 text-slate-300 hover:bg-black hover:text-white transition-colors"
                  aria-label="X"
                >
                  <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </a>
                {/* Instagram */}
                <a
                  href="https://instagram.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-8 w-8 items-center justify-center rounded bg-slate-800 text-slate-300 hover:bg-gradient-to-tr hover:from-amber-500 hover:via-pink-500 hover:to-purple-600 hover:text-white transition-colors"
                  aria-label="Instagram"
                >
                  <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                  </svg>
                </a>
                {/* YouTube */}
                <a
                  href="https://youtube.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-8 w-8 items-center justify-center rounded bg-slate-800 text-slate-300 hover:bg-[#FF0000] hover:text-white transition-colors"
                  aria-label="YouTube"
                >
                  <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom copyright line */}
        <div className="pt-6 text-center text-xs text-slate-500">
          <p>© {new Date().getFullYear()} {SITE_NAME}. All rights reserved.</p>
        </div>
      </Container>
    </footer>
  );
}
