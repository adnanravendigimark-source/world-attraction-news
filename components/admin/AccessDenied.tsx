// Defense-in-depth only — the real security boundary is server-side, in
// requireApiPermission() (see lib/permissions.ts), which every admin API
// route already enforces regardless of what renders here. This just saves
// a restricted admin from staring at a broken/empty page (failed fetches,
// missing data) if they land on a page they don't have Read access to —
// e.g. by typing the URL directly, since AdminSidebar already hides links
// they can't use.
export default function AccessDenied({ pageLabel }: { pageLabel: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-[#DC2626]">
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>
      <div>
        <h2 className="text-sm font-bold text-slate-900">You don&apos;t have access to {pageLabel}</h2>
        <p className="mt-1 text-xs text-slate-500">
          Ask an unrestricted admin to grant your role access to this page from Roles &amp; Permissions.
        </p>
      </div>
    </div>
  );
}
