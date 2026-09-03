import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";
import { SITE_NAME } from "@/lib/site";
import LoginForm from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: `Contributor Log In | ${SITE_NAME}`,
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Left Newsroom Branding Panel (Desktop) */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-[#0B1527] p-12 text-white relative overflow-hidden">
        <div className="relative z-10">
          <Link href="/" className="inline-block">
            <Logo variant="horizontal" theme="light" className="h-9 w-auto" />
          </Link>

          <div className="mt-20 max-w-md space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-rose-500/10 border border-rose-500/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#DC2626]">
              <span className="h-2 w-2 rounded-full bg-[#DC2626]" />
              Contributor Newsroom
            </div>

            <h2 className="text-3xl sm:text-4xl font-extrabold leading-tight tracking-tight text-white">
              The on-the-ground wire for global attraction journalism.
            </h2>

            <p className="text-sm text-slate-300 leading-relaxed">
              Log in to draft dispatches in our clean writing studio, submit articles for editorial verification, track live review scores, and build your regional byline.
            </p>

            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-3 text-xs text-slate-300 font-medium">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#DC2626] text-white text-[10px] font-bold">✓</span>
                <span>Direct access to the Notion-grade document editor</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-300 font-medium">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#DC2626] text-white text-[10px] font-bold">✓</span>
                <span>Real-time feedback &amp; 0–10 scoring on every story</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-300 font-medium">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#DC2626] text-white text-[10px] font-bold">✓</span>
                <span>Verified writer ranking and regional bureau attribution</span>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 border-t border-slate-800 pt-6 flex items-center justify-between text-xs text-slate-400">
          <span>© {new Date().getFullYear()} {SITE_NAME}</span>
          <Link href="/about" className="hover:text-white transition-colors">
            Editorial Standards
          </Link>
        </div>

        {/* Ambient Glow */}
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-[#DC2626]/10 rounded-full blur-[100px] pointer-events-none" />
      </div>

      {/* Right Login Form Panel */}
      <div className="flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm">
          {/* Mobile Logo */}
          <div className="lg:hidden mb-8 text-center">
            <Link href="/" className="inline-block">
              <Logo variant="horizontal" className="h-8 w-auto" />
            </Link>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-7 sm:p-9 shadow-2xs space-y-6">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#DC2626]">
                WRITER ACCESS
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
                Sign In to Your Desk
              </h1>
              <p className="mt-1 text-xs text-slate-500 font-medium">
                Enter your contributor credentials to access your dashboard.
              </p>
            </div>

            <Suspense fallback={<div className="text-xs text-slate-400 text-center py-4">Loading login...</div>}>
              <LoginForm />
            </Suspense>

            <div className="border-t border-slate-100 pt-4 text-center">
              <p className="text-xs text-slate-500 font-medium">
                Don't have a contributor account?{" "}
                <Link href="/signup" className="font-bold text-[#DC2626] hover:underline">
                  Apply to Write →
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
