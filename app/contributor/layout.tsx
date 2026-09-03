import Link from "next/link";
import Image from "next/image";
import { getSession } from "@/lib/session";
import { findUserById } from "@/lib/users";
import { getUnreadCount } from "@/lib/notifications";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import DashboardLogoutButton from "@/components/dashboard/DashboardLogoutButton";
import NotificationBell from "@/components/dashboard/NotificationBell";

export default async function ContributorLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const user = session ? await findUserById(session.userId).catch(() => undefined) : undefined;
  const avatarUrl = user?.avatarUrl;
  const displayName = session?.displayName || user?.displayName || session?.email?.split("@")[0] || "there";
  const roleName = user?.role === "admin" ? "Admin" : "Contributor";
  const unreadCount = session ? await getUnreadCount(session.userId) : 0;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 antialiased flex">
      {/* Fixed Left Sidebar */}
      <DashboardSidebar unreadCount={unreadCount} />

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0 md:pl-60">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white px-4 sm:px-8 shadow-2xs">
          {/* Left: Contributor Desk Badge */}
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 border border-rose-200 px-3 py-1 text-[11px] font-bold text-[#DC2626]">
              <span className="h-2 w-2 rounded-full bg-[#DC2626]" />
              CONTRIBUTOR DESK
            </span>
          </div>

          {/* Right: + Write Article, Notifications & User Profile */}
          <div className="flex items-center gap-3.5">
            <Link
              href="/contributor/articles/new"
              className="hidden lg:inline-flex items-center gap-1.5 rounded-xl bg-[#DC2626] px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-2xs hover:bg-[#B91C1C] transition-all"
            >
              <span>+ WRITE ARTICLE</span>
            </Link>

            <NotificationBell />

            {/* User Profile Pill */}
            <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200">
              <div className="relative h-8 w-8 overflow-hidden rounded-full bg-[#0B1527] text-white flex items-center justify-center font-bold text-xs shrink-0 ring-1 ring-slate-200">
                {avatarUrl ? (
                  <Image src={avatarUrl} alt="" fill className="object-cover" />
                ) : (
                  displayName.slice(0, 2).toUpperCase()
                )}
              </div>
              <div className="hidden sm:flex flex-col">
                <span className="text-xs font-bold text-slate-900 leading-tight">
                  {displayName}
                </span>
                <span className="text-[10px] font-medium text-slate-400 leading-none mt-0.5">
                  {roleName}
                </span>
              </div>
            </div>

            <DashboardLogoutButton />
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
