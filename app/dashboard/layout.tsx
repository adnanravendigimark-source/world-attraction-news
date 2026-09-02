import Link from "next/link";
import Logo from "@/components/Logo";
import { getSession } from "@/lib/session";
import DashboardLogoutButton from "@/components/dashboard/DashboardLogoutButton";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import NotificationBell from "@/components/dashboard/NotificationBell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  return (
    <div className="min-h-screen bg-slate-50 text-[#0B1527] flex flex-col antialiased">
      {/* Top Workspace Header Bar */}
      <header className="sticky top-0 z-40 border-b border-slate-200/90 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2.5 sm:px-6">
          {/* Logo & Bureau Badge */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 group">
              <Logo variant="compact" className="h-7 w-auto" />
            </Link>
            <span className="text-slate-300 font-bold hidden sm:inline">|</span>
            <div className="hidden sm:flex items-center gap-1.5 rounded-md bg-rose-50 border border-rose-100 px-2 py-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#DC2626] animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#DC2626]">
                CONTRIBUTOR DESK
              </span>
            </div>
          </div>

          {/* User Controls */}
          {session ? (
            <div className="flex items-center gap-3 sm:gap-4">
              <Link
                href="/dashboard/articles/new"
                className="hidden md:inline-flex items-center gap-1.5 rounded-lg bg-[#DC2626] px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#B91C1C] transition-colors shadow-2xs"
              >
                <span>+ Write Article</span>
              </Link>

              <NotificationBell />

              <div className="flex items-center gap-2 border-l border-slate-200 pl-3 sm:pl-4">
                <div className="h-6 w-6 rounded-full bg-[#0B1527] text-white flex items-center justify-center font-bold text-[9px]">
                  {session.displayName?.slice(0, 2).toUpperCase() || "AN"}
                </div>
                <span className="hidden sm:inline font-semibold text-xs text-slate-800">
                  {session.displayName || session.email}
                </span>
              </div>

              <DashboardLogoutButton />
            </div>
          ) : (
            <div className="flex items-center gap-3 text-xs font-bold">
              <Link href="/login" className="text-slate-600 hover:text-[#DC2626] transition-colors">
                Sign In
              </Link>
              <Link
                href="/signup"
                className="rounded-lg bg-[#DC2626] px-3 py-1.5 text-white hover:bg-[#B91C1C] transition-colors shadow-2xs"
              >
                Apply as Writer
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* Main Workspace Body */}
      <div className="mx-auto flex max-w-7xl w-full flex-1 gap-6 px-4 py-5 sm:px-6 sm:py-6">
        {session && <DashboardSidebar />}
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
