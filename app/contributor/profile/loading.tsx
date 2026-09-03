// Skeleton for the Profile Settings page while findUserById resolves —
// matches the page's actual shape (header, identity card, two form cards).
export default function Loading() {
  return (
    <div className="max-w-3xl space-y-6 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-2xl bg-slate-100 shrink-0" />
        <div className="space-y-2">
          <div className="h-6 w-44 rounded bg-slate-200" />
          <div className="h-3 w-72 rounded bg-slate-100" />
        </div>
      </div>

      <div className="flex items-center gap-4 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs">
        <div className="h-14 w-14 rounded-full bg-slate-100 shrink-0" />
        <div className="space-y-2">
          <div className="h-4 w-32 rounded bg-slate-200" />
          <div className="h-3 w-40 rounded bg-slate-100" />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xs space-y-4">
        <div className="h-4 w-40 rounded bg-slate-200" />
        <div className="h-24 w-full rounded-xl bg-slate-100" />
      </div>

      <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xs space-y-4">
        <div className="h-4 w-48 rounded bg-slate-200" />
        <div className="h-20 w-full rounded-xl bg-slate-100" />
      </div>
    </div>
  );
}
