// Skeleton for the Admin Articles list while getAllArticles() resolves —
// matches ArticlesQueue's actual shape (status tabs, filter toolbar, rows).
export default function Loading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div className="space-y-2">
          <div className="h-6 w-52 rounded bg-slate-200" />
          <div className="h-3 w-72 rounded bg-slate-100" />
        </div>
        <div className="h-9 w-32 rounded-lg bg-slate-200" />
      </div>

      <div className="flex gap-1.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-8 w-24 rounded-lg bg-slate-100" />
        ))}
      </div>

      <div className="h-12 rounded-xl border border-slate-200 bg-white shadow-2xs" />

      <div className="space-y-2.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl border border-slate-200 bg-white shadow-2xs" />
        ))}
      </div>
    </div>
  );
}
