export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-14 rounded-xl border border-slate-200 bg-white shadow-2xs" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl border border-slate-200 bg-white shadow-2xs" />
        ))}
      </div>
      <div className="h-64 rounded-2xl border border-slate-200 bg-white shadow-2xs" />
    </div>
  );
}
