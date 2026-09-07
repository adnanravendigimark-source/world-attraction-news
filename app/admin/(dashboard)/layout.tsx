import Link from "next/link";
import Image from "next/image";
import { getSession } from "@/lib/session";
import { findUserById, getPendingContributorCount } from "@/lib/users";
import { getPendingArticleCount } from "@/lib/articles";
import { getEffectivePermissions, hasPermission } from "@/lib/permissions";
import { ADMIN_PAGES } from "@/lib/roles";
import AdminLogoutButton from "@/components/admin/AdminLogoutButton";
import AdminSidebar from "@/components/admin/AdminSidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  // Real, live counts — not a fake fixed badge. Both are lightweight
  // COUNT(*) queries (see lib/articles.ts / lib/users.ts) since this header
  // renders on every single admin page, not just the Overview.
  const [user, pendingArticles, pendingContributors, effectivePermissions] = await Promise.all([
    session ? findUserById(session.userId).catch(() => undefined) : Promise.resolve(undefined),
    getPendingArticleCount(),
    getPendingContributorCount(),
    getEffectivePermissions(session),
  ]);
  const avatarUrl = user?.avatarUrl;
  const displayName = session?.displayName || user?.displayName || "Adnan";
  const actionableCount = pendingArticles + pendingContributors;
  // Sidebar filtering is UX convenience only (see AdminSidebar's own
  // comment) — the real enforcement is requireApiPermission() on every
  // admin API route and the per-page AccessDenied guards.
  const readablePages: "full" | string[] =
    effectivePermissions === "full"
      ? "full"
      : ADMIN_PAGES.filter((p) => hasPermission(effectivePermissions, p.key, "read")).map((p) => p.key);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 antialiased flex">
      {/* Fixed Left Sidebar */}
      <AdminSidebar
        pendingArticles={pendingArticles}
        pendingContributors={pendingContributors}
        readablePages={readablePages}
      />

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0 md:pl-60">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white px-4 sm:px-8 shadow-2xs">
          {/* Left: Admin Control Badge */}
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 border border-rose-200 px-3 py-1 text-[11px] font-bold text-[#DC2626]">
              <span className="h-2 w-2 rounded-full bg-[#DC2626]" />
              ADMIN CONTROL
            </span>
          </div>

          {/* Right: Notifications & Administrator Profile */}
          <div className="flex items-center gap-4">
            {/* Action Bell — real count of pending articles + pending
                verified contributor applications, not a fake fixed badge. */}
            <Link
              href="/admin/articles?status=pending"
              className="relative p-2 text-slate-500 hover:text-slate-900 transition-colors"
              title={
                actionableCount > 0
                  ? `${actionableCount} item${actionableCount === 1 ? "" : "s"} awaiting your review`
                  : "You're all caught up"
              }
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {actionableCount > 0 && (
                <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#DC2626] text-[9px] font-bold text-white">
                  {actionableCount > 9 ? "9+" : actionableCount}
                </span>
              )}
            </Link>

            {/* Administrator Profile Pill */}
            <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200">
              <div className="relative h-8 w-8 overflow-hidden rounded-full bg-[#0B1527] text-white flex items-center justify-center font-bold text-xs shrink-0 ring-1 ring-slate-200">
                {avatarUrl ? (
                  <Image src={avatarUrl} alt="" fill className="object-cover" />
                ) : (
                  displayName.slice(0, 2).toUpperCase()
                )}
              </div>
              <div className="hidden sm:flex flex-col">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-bold text-slate-900 leading-tight">
                    {displayName}
                  </span>
                  <span className="text-[10px] text-slate-400">⌄</span>
                </div>
                <span className="text-[10px] font-medium text-slate-400 leading-none mt-0.5">
                  Administrator
                </span>
              </div>
            </div>

            <AdminLogoutButton />
          </div>
        </header>

        {/* Page Content Viewport */}
        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
