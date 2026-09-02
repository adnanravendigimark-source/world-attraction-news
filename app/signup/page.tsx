import type { Metadata } from "next";
import Link from "next/link";
import Logo from "@/components/Logo";
import { SITE_NAME } from "@/lib/site";
import SignupForm from "@/components/auth/SignupForm";

export const metadata: Metadata = {
  title: `Apply to Become a Contributor | ${SITE_NAME}`,
  robots: { index: false, follow: false },
};

export default function SignupPage() {
  return (
    <div className="flex min-h-screen bg-paper">
      {/* Left Branding Panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-ink-950 p-12 text-white relative overflow-hidden">
        <div className="relative z-10">
          <Link href="/" className="inline-block">
            <Logo variant="horizontal" theme="light" showTagline className="h-10 w-auto" />
          </Link>
          <div className="mt-16 max-w-md">
            <div className="flex items-center gap-2 mb-3">
              <span className="h-2 w-2 rounded-full bg-signal" />
              <span className="text-[11px] font-mono font-bold uppercase tracking-[0.2em] text-signal">
                Correspondent Application
              </span>
            </div>
            <h2 className="font-serif text-3xl sm:text-4xl font-black leading-tight text-white">
              Report on the landmarks and attractions shaping your city.
            </h2>
            <div className="mt-6 space-y-3 text-xs sm:text-sm text-ink-300">
              <div className="flex items-start gap-2.5">
                <span className="text-signal font-bold">✓</span>
                <p>Earn contributor ranking and verified byline attribution.</p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="text-signal font-bold">✓</span>
                <p>Access our streamlined distraction-free writing environment.</p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="text-signal font-bold">✓</span>
                <p>Receive detailed 0-10 editorial feedback on every submitted dispatch.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 border-t border-ink-800 pt-6 flex items-center justify-between text-xs text-ink-400">
          <span>© {new Date().getFullYear()} {SITE_NAME}</span>
          <Link href="/editorial-policy" className="hover:text-white transition-colors">Editorial Guidelines</Link>
        </div>

        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(194,41,56,0.15),rgba(255,255,255,0))]" />
      </div>

      {/* Right Signup Form Panel */}
      <div className="flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:px-20 xl:px-24 bg-paper-50">
        <div className="mx-auto w-full max-w-md">
          <div className="lg:hidden mb-8 text-center">
            <Link href="/" className="inline-block">
              <Logo variant="horizontal" showTagline className="h-8 w-auto" />
            </Link>
          </div>

          <div className="rounded-2xl border border-ink-200/80 bg-white p-7 sm:p-9 shadow-card">
            <div className="mb-6">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-signal">
                Correspondent Network
              </span>
              <h1 className="font-serif text-2xl font-black tracking-tight text-ink-950 mt-1">
                Apply for Access
              </h1>
              <p className="mt-1 text-xs text-ink-500 leading-relaxed">
                Applications are reviewed by our editorial team to ensure verified coverage.
              </p>
            </div>

            <SignupForm />
          </div>
        </div>
      </div>
    </div>
  );
}
