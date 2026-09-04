// Skeleton for the Admin Activity audit log page — header bar, then a list
// of log entries.
export default function Loading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-14 rounded-xl border border-slate-200 bg-white shadow-2xs" />
      <div className="space-y-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="h-12 rounded-xl border border-slate-200 bg-white shadow-2xs" />
        ))}
      </div>
    </div>
  );
}
