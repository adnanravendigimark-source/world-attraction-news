import Link from "next/link";

// Simple, crawlable pagination — real <a>/<Link> href pages (good for SEO
// and no-JS), not a client-only "load more" button pretending to page
// through content search engines can't see.
export default function Pagination({
  page,
  totalPages,
  basePath,
  searchParams = {},
}: {
  page: number;
  totalPages: number;
  basePath: string;
  searchParams?: Record<string, string | undefined>;
}) {
  if (totalPages <= 1) return null;

  function hrefFor(p: number) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      if (v) params.set(k, v);
    }
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  const prevDisabled = page <= 1;
  const nextDisabled = page >= totalPages;

  return (
    <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-3">
      {prevDisabled ? (
        <span className="rounded-md border border-ink-200 px-3.5 py-2 text-xs font-semibold text-ink-300">← Previous</span>
      ) : (
        <Link href={hrefFor(page - 1)} className="rounded-md border border-ink-300 px-3.5 py-2 text-xs font-semibold text-ink-700 hover:border-ink-900">
          ← Previous
        </Link>
      )}
      <span className="text-xs font-medium text-ink-500">
        Page {page} of {totalPages}
      </span>
      {nextDisabled ? (
        <span className="rounded-md border border-ink-200 px-3.5 py-2 text-xs font-semibold text-ink-300">Next →</span>
      ) : (
        <Link href={hrefFor(page + 1)} className="rounded-md border border-ink-300 px-3.5 py-2 text-xs font-semibold text-ink-700 hover:border-ink-900">
          Next →
        </Link>
      )}
    </nav>
  );
}
