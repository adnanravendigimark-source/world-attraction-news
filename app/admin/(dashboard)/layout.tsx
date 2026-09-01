import Link from "next/link";
import Logo from "@/components/Logo";
import { getSession } from "@/lib/session";
import { SITE_NAME } from "@/lib/site";
import AdminLogoutButton from "@/components/admin/AdminLogoutButton";
import AdminSidebar from "@/components/admin/AdminSidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  return (
    <div className="min-h-screen bg-ink-50">
      <header className="border-b border-ink-800 bg-ink-900">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/admin" className="flex items-center gap-2">
            <Logo className="h-7 w-7" />
            <span className="font-serif text-base font-bold text-white">{SITE_NAME}</span>
            <span className="rounded bg-signal px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
              Admin
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="hidden text-xs text-ink-400 sm:inline">{session?.email}</span>
            <AdminLogoutButton />
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-7xl gap-8 px-4 py-8 sm:px-6">
        <AdminSidebar />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
