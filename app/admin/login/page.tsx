import type { Metadata } from "next";
import { Suspense } from "react";
import Logo from "@/components/Logo";
import AdminLoginForm from "@/components/admin/AdminLoginForm";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `Editorial Desk Log In | ${SITE_NAME}`,
  robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 px-4 py-12 relative overflow-hidden">
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-ink-800/80 bg-ink-900/90 backdrop-blur-md p-8 shadow-lift">
        <div className="flex items-center gap-3 border-b border-ink-800 pb-5">
          <Logo variant="mark" theme="dark" className="h-9 w-9" />
          <div>
            <span className="font-serif text-lg font-black tracking-tight text-white">{SITE_NAME}</span>
            <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-signal">
              Editorial CMS
            </p>
          </div>
        </div>

        <h1 className="mt-6 font-serif text-xl font-bold text-white">Editorial Staff Sign In</h1>
        <p className="mt-1 text-xs text-ink-400">
          Enter your newsroom administrative credentials.
        </p>

        <div className="mt-6">
          <Suspense fallback={null}>
            <AdminLoginForm />
          </Suspense>
        </div>
      </div>

      {/* Subtle radial ambient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_50%,rgba(194,41,56,0.12),rgba(10,11,14,1))]" />
    </div>
  );
}
