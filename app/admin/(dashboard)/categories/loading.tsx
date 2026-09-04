// Skeleton for the Admin Categories page — header bar, then a grid of
// category cards.
export default function Loading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-14 rounded-xl border border-slate-200 bg-white shadow-2xs" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-32 rounded-2xl border border-slate-200 bg-white shadow-2xs" />
        ))}
      </div>
    </div>
  );
}
