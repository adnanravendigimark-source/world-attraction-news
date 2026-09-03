// Skeleton for the Notifications page while getNotifications resolves —
// matches NotificationsList's actual shape (filter tabs, notification rows).
export default function Loading() {
  return (
    <div className="space-y-6 max-w-4xl animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-2xl bg-slate-100 shrink-0" />
        <div className="space-y-2">
          <div className="h-6 w-40 rounded bg-slate-200" />
          <div className="h-3 w-64 rounded bg-slate-100" />
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <div className="h-7 w-16 rounded-full bg-slate-100" />
        <div className="h-7 w-20 rounded-full bg-slate-100" />
      </div>

      <div className="rounded-2xl border border-slate-200/90 bg-white shadow-2xs divide-y divide-slate-100">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-start gap-4 p-4">
            <div className="h-9 w-9 rounded-xl bg-slate-100 shrink-0" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-3.5 w-2/3 rounded bg-slate-200" />
              <div className="h-3 w-1/2 rounded bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
