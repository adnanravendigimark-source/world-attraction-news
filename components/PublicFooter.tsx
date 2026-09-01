import Link from "next/link";
import Logo from "./Logo";
import Container from "./Container";
import NewsletterForm from "./NewsletterForm";
import { SITE_NAME, SITE_TAGLINE, CONTACT_EMAIL } from "@/lib/site";

export default function PublicFooter({
  cities,
  categories,
}: {
  cities: { slug: string; name: string }[];
  categories: { slug: string; name: string }[];
}) {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t-2 border-ink-900 bg-ink-900 text-ink-300">
      <Container className="border-b border-ink-800 py-10">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="font-serif text-lg font-bold text-white">Stay in the loop</p>
            <p className="mt-1 text-xs text-ink-400">
              New attraction openings, ticket changes, and travel updates — straight to your inbox.
            </p>
          </div>
          <div className="w-full sm:w-96">
            <NewsletterForm source="footer" variant="dark" />
          </div>
        </div>
      </Container>

      <Container className="py-12 sm:py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2.5">
              <Logo className="h-8 w-8 shrink-0" />
              <span className="font-serif text-lg font-bold text-white">{SITE_NAME}</span>
            </div>
            <p className="mt-3.5 max-w-sm text-xs leading-relaxed text-ink-400">
              {SITE_TAGLINE}. Every article is written by an approved local contributor and reviewed by our editorial
              team before publication — no aggregated links, no unreviewed submissions.
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">Cities</p>
            <ul className="mt-3.5 space-y-2">
              {cities.slice(0, 8).map((c) => (
                <li key={c.slug}>
                  <Link href={`/cities/${c.slug}`} className="text-xs text-ink-300 transition-colors hover:text-white">
                    {c.name}
                  </Link>
                </li>
              ))}
              <li className="pt-1">
                <Link href="/cities" className="text-xs font-semibold text-signal hover:underline">
                  All cities →
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">Categories</p>
            <ul className="mt-3.5 space-y-2">
              {categories.slice(0, 8).map((c) => (
                <li key={c.slug}>
                  <Link href={`/categories/${c.slug}`} className="text-xs text-ink-300 transition-colors hover:text-white">
                    {c.name}
                  </Link>
                </li>
              ))}
              <li className="pt-1">
                <Link href="/categories" className="text-xs font-semibold text-signal hover:underline">
                  All categories →
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">About</p>
            <ul className="mt-3.5 space-y-2">
              <li>
                <Link href="/about" className="text-xs text-ink-300 transition-colors hover:text-white">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/write-for-us" className="text-xs text-ink-300 transition-colors hover:text-white">
                  Write for Us
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-xs text-ink-300 transition-colors hover:text-white">
                  Contact
                </Link>
              </li>
              <li>
                <Link href="/signup" className="text-xs text-ink-300 transition-colors hover:text-white">
                  Become a Contributor
                </Link>
              </li>
              <li className="pt-1">
                <a href={`mailto:${CONTACT_EMAIL}`} className="text-xs text-ink-300 transition-colors hover:text-white">
                  {CONTACT_EMAIL}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-ink-800 pt-6 text-[11px] text-ink-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} {SITE_NAME}. All articles are written and reviewed independently.</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            <Link href="/privacy-policy" className="hover:text-white">Privacy Policy</Link>
            <Link href="/terms-and-conditions" className="hover:text-white">Terms &amp; Conditions</Link>
            <Link href="/cookie-policy" className="hover:text-white">Cookie Policy</Link>
            <Link href="/editorial-policy" className="hover:text-white">Editorial Policy</Link>
            <Link href="/disclaimer" className="hover:text-white">Disclaimer</Link>
          </div>
        </div>
      </Container>
    </footer>
  );
}
