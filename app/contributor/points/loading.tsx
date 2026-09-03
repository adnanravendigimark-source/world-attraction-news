// Skeleton for the Points & Scores page while getArticlesByAuthor resolves —
// matches the page's actual shape (header, 3 KPI cards, review history list).
export default function Loading() {
  return (
    <div className="space-y-6 max-w-5xl animate-pulse">
      <div className="space-y-2">
        <div className="h-6 w-48 rounded bg-slate-200" />
        <div className="h-3 w-72 rounded bg-slate-100" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs h-24" />
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200/90 bg-white shadow-2xs divide-y divide-slate-100">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="p-5 space-y-2">
            <div className="h-4 w-1/2 rounded bg-slate-200" />
            <div className="h-3 w-1/3 rounded bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
