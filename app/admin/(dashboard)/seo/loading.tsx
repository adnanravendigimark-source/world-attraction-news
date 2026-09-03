export default function Loading() {
  return (
    <div className="max-w-2xl space-y-5 animate-pulse">
      <div className="h-16 rounded-xl border border-slate-200 bg-white shadow-2xs" />
      <div className="h-56 rounded-2xl border border-slate-200 bg-white shadow-2xs" />
      <div className="h-32 rounded-2xl border border-slate-200 bg-white shadow-2xs" />
    </div>
  );
}
