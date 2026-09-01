import Link from "next/link";
import Logo from "@/components/Logo";
import { getSession } from "@/lib/session";
import { SITE_NAME } from "@/lib/site";
import DashboardLogoutButton from "@/components/dashboard/DashboardLogoutButton";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  return (
    <div className="min-h-screen bg-ink-50">
      <header className="border-b border-ink-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <Logo className="h-7 w-7" />
            <span className="font-serif text-base font-bold text-ink-900">{SITE_NAME}</span>
            <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-500">
              Contributor
            </span>
          </Link>
          {session ? (
            <div className="flex items-center gap-4">
              <span className="hidden text-xs text-ink-500 sm:inline">{session.email}</span>
              <DashboardLogoutButton />
            </div>
          ) : (
            <div className="flex items-center gap-3 text-xs font-semibold">
              <Link href="/login" className="text-ink-600 hover:text-signal">
                Log In
              </Link>
              <Link href="/signup" className="rounded-md bg-signal px-3 py-1.5 text-white hover:bg-signal-dark">
                Apply
              </Link>
            </div>
          )}
        </div>
      </header>
      <div className="mx-auto flex max-w-6xl gap-8 px-4 py-8 sm:px-6">
        {session && <DashboardSidebar />}
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
