import Link from "next/link";

// Numbered variant of Pagination.tsx's philosophy: real, crawlable <Link>
// hrefs that carry the current filters over to each page (not client-only
// buttons that just set local state and never actually fetch a different
// page of data).
export default function NumberedPagination({
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

  // Show up to 5 page numbers centered on the current page, so the control
  // stays a fixed, readable width even with a large real totalPages count.
  const windowSize = 5;
  let start = Math.max(1, page - Math.floor(windowSize / 2));
  const end = Math.min(totalPages, start + windowSize - 1);
  start = Math.max(1, end - windowSize + 1);
  const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);

  return (
    <nav aria-label="Pagination" className="mt-6 flex items-center justify-center gap-2">
      {page > 1 && (
        <Link
          href={hrefFor(page - 1)}
          aria-label="Previous page"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-100"
        >
          ‹
        </Link>
      )}
      {start > 1 && (
        <>
          <Link href={hrefFor(1)} className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-100">
            1
          </Link>
          {start > 2 && <span className="px-1 text-xs text-slate-400">…</span>}
        </>
      )}
      {pages.map((p) =>
        p === page ? (
          <span key={p} className="flex h-8 w-8 items-center justify-center rounded-full bg-[#DC2626] text-xs font-bold text-white shadow-sm">
            {p}
          </span>
        ) : (
          <Link
            key={p}
            href={hrefFor(p)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-100"
          >
            {p}
          </Link>
        )
      )}
      {end < totalPages && (
        <>
          {end < totalPages - 1 && <span className="px-1 text-xs text-slate-400">…</span>}
          <Link href={hrefFor(totalPages)} className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-100">
            {totalPages}
          </Link>
        </>
      )}
      {page < totalPages && (
        <Link
          href={hrefFor(page + 1)}
          aria-label="Next page"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-100"
        >
          ›
        </Link>
      )}
    </nav>
  );
}
