// Skeleton for the Admin Users/Contributors page — header bar with filters,
// then a table of rows.
export default function Loading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-14 rounded-xl border border-slate-200 bg-white shadow-2xs" />
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-14 rounded-xl border border-slate-200 bg-white shadow-2xs" />
        ))}
      </div>
    </div>
  );
}
