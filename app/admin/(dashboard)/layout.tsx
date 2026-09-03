import Link from "next/link";
import Logo from "@/components/Logo";
import { getSession } from "@/lib/session";
import { SITE_NAME } from "@/lib/site";
import AdminLogoutButton from "@/components/admin/AdminLogoutButton";
import AdminSidebar from "@/components/admin/AdminSidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  return (
    <div className="min-h-screen bg-slate-50 text-[#0B1527] flex flex-col antialiased">
      {/* Top Admin CMS Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200/90 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="flex items-center gap-2 group">
              <Logo variant="compact" className="h-7 w-auto" />
            </Link>
            <span className="text-slate-300 font-bold hidden sm:inline">|</span>
            <div className="flex items-center gap-1.5 rounded-md bg-rose-50 border border-rose-100 px-2.5 py-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#DC2626] animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#DC2626]">
                ADMIN CONTROL
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <span className="hidden sm:inline text-xs font-medium text-slate-500">{session?.email}</span>
            <div className="h-4 w-px bg-slate-200 hidden sm:inline" />
            <AdminLogoutButton />
          </div>
        </div>
      </header>

      {/* Main Admin Dashboard Body */}
      <div className="mx-auto flex max-w-7xl w-full flex-1 gap-6 px-4 py-5 sm:px-6 sm:py-6">
        <AdminSidebar />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
