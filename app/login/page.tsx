import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";
import { SITE_NAME } from "@/lib/site";
import LoginForm from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: `Contributor Portal Log In | ${SITE_NAME}`,
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <div className="flex min-h-screen bg-paper">
      {/* Left Editorial Branding Panel (Hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-ink-950 p-12 text-white relative overflow-hidden">
        <div className="relative z-10">
          <Link href="/" className="inline-block">
            <Logo variant="horizontal" theme="light" showTagline className="h-10 w-auto" />
          </Link>
          <div className="mt-20 max-w-md">
            <div className="flex items-center gap-2 mb-3">
              <span className="h-2 w-2 rounded-full bg-signal" />
              <span className="text-[11px] font-mono font-bold uppercase tracking-[0.2em] text-signal">
                Contributor Desk
              </span>
            </div>
            <h2 className="font-serif text-3xl sm:text-4xl font-black leading-tight text-white">
              The on-the-ground newsroom for global attraction journalism.
            </h2>
            <p className="mt-4 text-sm text-ink-300 leading-relaxed">
              Log in to file dispatches, track editorial review scores, manage drafts in the Notion-style writing canvas, and build your contributor profile.
            </p>
          </div>
        </div>

        <div className="relative z-10 border-t border-ink-800 pt-6 flex items-center justify-between text-xs text-ink-400">
          <span>© {new Date().getFullYear()} {SITE_NAME}</span>
          <Link href="/about" className="hover:text-white transition-colors">Editorial Standards</Link>
        </div>

        {/* Decorative Grid Lines */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(194,41,56,0.15),rgba(255,255,255,0))]" />
      </div>

      {/* Right Login Form Panel */}
      <div className="flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:px-20 xl:px-24 bg-paper-50">
        <div className="mx-auto w-full max-w-sm lg:w-96">
          <div className="lg:hidden mb-8 text-center">
            <Link href="/" className="inline-block">
              <Logo variant="horizontal" showTagline className="h-8 w-auto" />
            </Link>
          </div>

          <div className="rounded-2xl border border-ink-200/80 bg-white p-7 sm:p-9 shadow-card">
            <div className="mb-6">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-signal">
                Correspondent Workspace
              </span>
              <h1 className="font-serif text-2xl font-black tracking-tight text-ink-950 mt-1">
                Sign In to Your Desk
              </h1>
              <p className="mt-1 text-xs text-ink-500">
                Access your drafts, published dispatches, and review feedback.
              </p>
            </div>

            <Suspense fallback={null}>
              <LoginForm />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
