// Skeleton for the Admin Overview page while its 5 parallel queries
// resolve — matches the page's actual shape (banner, 8 stat cards, 2-column
// review/published lists).
export default function Loading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-20 rounded-xl border border-slate-200 bg-white shadow-2xs" />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl border border-slate-200 bg-white shadow-2xs" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl border border-slate-200 bg-white shadow-2xs" />
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="h-72 rounded-xl border border-slate-200 bg-white shadow-2xs" />
        <div className="h-72 rounded-xl border border-slate-200 bg-white shadow-2xs" />
      </div>
    </div>
  );
}
