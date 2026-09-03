// Skeleton for the Admin Article Review page while its data resolves —
// matches ArticleReviewPanel's review-mode shape (header, wide content
// card, review sidebar).
export default function Loading() {
  return (
    <div className="max-w-6xl space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-3 w-28 rounded bg-slate-100" />
        <div className="h-7 w-2/3 rounded bg-slate-200" />
        <div className="h-3 w-1/2 rounded bg-slate-100" />
      </div>

      <div className="grid gap-6 lg:grid-cols-12 items-start">
        <div className="lg:col-span-8 space-y-5">
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-10 shadow-2xs space-y-4">
            <div className="h-56 w-full rounded-xl bg-slate-100" />
            <div className="space-y-2">
              <div className="h-3 w-full rounded bg-slate-100" />
              <div className="h-3 w-full rounded bg-slate-100" />
              <div className="h-3 w-2/3 rounded bg-slate-100" />
            </div>
          </div>
        </div>
        <div className="lg:col-span-4 space-y-5">
          <div className="h-28 rounded-2xl border border-slate-200/90 bg-white shadow-2xs" />
          <div className="h-80 rounded-2xl border border-slate-200/90 bg-white shadow-2xs" />
        </div>
      </div>
    </div>
  );
}
