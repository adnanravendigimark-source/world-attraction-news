import Link from "next/link";
import Container from "@/components/Container";
import SearchForm from "@/components/SearchForm";

const QUICK_LINKS = [
  { href: "/latest-news", label: "Latest News" },
  { href: "/destinations", label: "Browse Destinations" },
  { href: "/categories", label: "Browse Categories" },
];

export default function NotFound() {
  return (
    <Container className="flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
      <p className="font-serif text-7xl font-bold text-ink-900">404</p>
      <h1 className="mt-3 font-serif text-xl font-bold text-ink-800">This story doesn't exist</h1>
      <p className="mt-2 max-w-sm text-sm text-ink-500">
        The article or page you're looking for doesn't exist, may have been unpublished, or the link may be
        outdated.
      </p>

      <div className="mt-6 w-full max-w-sm">
        <SearchForm placeholder="Search for something else…" />
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        {QUICK_LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-md border border-ink-300 px-4 py-2 text-xs font-semibold text-ink-700 hover:border-ink-900"
          >
            {l.label}
          </Link>
        ))}
        <Link href="/" className="rounded-md bg-signal px-4 py-2 text-xs font-semibold text-white hover:bg-signal-dark">
          Back to Homepage
        </Link>
      </div>
    </Container>
  );
}
