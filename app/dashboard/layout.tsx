import Link from "next/link";
import Logo from "@/components/Logo";
import { getSession } from "@/lib/session";
import { SITE_NAME } from "@/lib/site";
import DashboardLogoutButton from "@/components/dashboard/DashboardLogoutButton";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import NotificationBell from "@/components/dashboard/NotificationBell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  return (
    <div className="min-h-screen bg-paper-50 flex flex-col">
      {/* Top Contributor Workspace Bar */}
      <header className="sticky top-0 z-40 border-b border-ink-200/80 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 group">
              <Logo variant="compact" className="h-7 w-auto" />
            </Link>
            <span className="text-ink-300">/</span>
            <span className="rounded-full bg-paper-200 px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-ink-700">
              Contributor Desk
            </span>
          </div>

          {session ? (
            <div className="flex items-center gap-4">
              <NotificationBell />
              <div className="hidden sm:flex items-center gap-2 border-l border-ink-200 pl-4 text-xs">
                <span className="font-semibold text-ink-800">{session.displayName || session.email}</span>
              </div>
              <DashboardLogoutButton />
            </div>
          ) : (
            <div className="flex items-center gap-3 text-xs font-bold">
              <Link href="/login" className="text-ink-600 hover:text-signal">
                Sign In
              </Link>
              <Link href="/signup" className="rounded-lg bg-signal px-3.5 py-1.5 text-white hover:bg-signal-dark shadow-subtle">
                Apply as Writer
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* Main Workspace Body */}
      <div className="mx-auto flex max-w-7xl w-full flex-1 gap-8 px-4 py-8 sm:px-6">
        {session && <DashboardSidebar />}
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
