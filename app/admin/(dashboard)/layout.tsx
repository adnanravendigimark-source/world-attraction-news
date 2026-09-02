import Link from "next/link";
import Logo from "@/components/Logo";
import { getSession } from "@/lib/session";
import { SITE_NAME } from "@/lib/site";
import AdminLogoutButton from "@/components/admin/AdminLogoutButton";
import AdminSidebar from "@/components/admin/AdminSidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  return (
    <div className="min-h-screen bg-ink-900/10 flex flex-col">
      {/* Top Editorial CMS Header */}
      <header className="sticky top-0 z-40 border-b border-ink-800 bg-ink-950/95 backdrop-blur-md text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="flex items-center gap-2.5">
              <Logo variant="mark" theme="dark" className="h-7 w-7" />
              <span className="font-serif text-base font-black tracking-tight text-white">{SITE_NAME}</span>
            </Link>
            <span className="text-ink-600">/</span>
            <span className="rounded bg-signal px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-white shadow-sm">
              Editorial CMS
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span className="hidden text-xs font-mono text-ink-400 sm:inline">{session?.email}</span>
            <AdminLogoutButton />
          </div>
        </div>
      </header>

      {/* Main Admin Dashboard Body */}
      <div className="mx-auto flex max-w-7xl w-full flex-1 gap-8 px-4 py-8 sm:px-6">
        <AdminSidebar />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
