// Skeleton for the article detail page while getArticleById resolves —
// matches the redesigned page's shape (header card, stats row, body card).
export default function Loading() {
  return (
    <div className="max-w-5xl space-y-6 animate-pulse">
      <div className="h-3 w-32 rounded bg-slate-100" />

      <div className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-2xs space-y-4">
        <div className="h-7 w-2/3 rounded bg-slate-200" />
        <div className="h-3 w-1/2 rounded bg-slate-100" />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs h-20" />
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-10 shadow-2xs space-y-4">
        <div className="h-56 w-full rounded-xl bg-slate-100" />
        <div className="space-y-2">
          <div className="h-3 w-full rounded bg-slate-100" />
          <div className="h-3 w-full rounded bg-slate-100" />
          <div className="h-3 w-2/3 rounded bg-slate-100" />
        </div>
      </div>
    </div>
  );
}
