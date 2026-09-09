import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import Logo from "@/components/Logo";
import AdminLoginForm from "@/components/admin/AdminLoginForm";
import { getSession } from "@/lib/session";
import { SITE_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Admin Control Login | ${SITE_NAME}`,
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage() {
  const session = await getSession();
  if (session?.role === "admin") {
    redirect("/admin/overview");
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#070D18] px-4 py-12 relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#DC2626]/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/90 backdrop-blur-xl p-8 shadow-2xl space-y-6">
        {/* Masthead */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-5">
          <Link href="/" className="inline-block">
            <Logo variant="horizontal" theme="light" className="h-8 w-auto" />
          </Link>
          <span className="rounded bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-[#DC2626]">
            ADMIN CONTROL
          </span>
        </div>

        {/* Title */}
        <div>
          <h1 className="text-xl font-bold text-white">Editorial Staff Sign In</h1>
          <p className="mt-1 text-xs text-slate-400 font-medium">
            Authorized administrator credentials required to access the newsroom desk.
          </p>
        </div>

        {/* Form */}
        <Suspense fallback={<div className="text-xs text-slate-500 text-center py-4">Loading login...</div>}>
          <AdminLoginForm />
        </Suspense>

        {/* Footer */}
        <div className="border-t border-slate-800 pt-4 text-center">
          <Link
            href="/"
            className="text-xs font-semibold text-slate-400 hover:text-white transition-colors"
          >
            ← Back to Public Website
          </Link>
        </div>
      </div>
    </div>
  );
}
