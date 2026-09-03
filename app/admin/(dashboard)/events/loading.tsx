// Skeleton for the Admin Events page — matches the page's actual shape
// (header bar with filters, then a list of event rows).
export default function Loading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-14 rounded-xl border border-slate-200 bg-white shadow-2xs" />
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 rounded-xl border border-slate-200 bg-white shadow-2xs" />
        ))}
      </div>
    </div>
  );
}
