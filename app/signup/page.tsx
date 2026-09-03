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
    <div className="flex min-h-screen bg-slate-50">
      {/* Left Branding Panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-[#0B1527] p-12 text-white relative overflow-hidden">
        <div className="relative z-10">
          <Link href="/" className="inline-block">
            <Logo variant="horizontal" theme="light" className="h-9 w-auto" />
          </Link>

          <div className="mt-16 max-w-md space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-rose-500/10 border border-rose-500/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#DC2626]">
              <span className="h-2 w-2 rounded-full bg-[#DC2626]" />
              Correspondent Application
            </div>

            <h2 className="text-3xl sm:text-4xl font-extrabold leading-tight tracking-tight text-white">
              Report on the landmarks and attractions shaping your destination.
            </h2>

            <p className="text-sm text-slate-300 leading-relaxed">
              Join World Attraction News as an accredited destination correspondent. Submit dispatches from your region, track quality scores, and gain global readership.
            </p>

            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-3 text-xs text-slate-300 font-medium">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#DC2626] text-white text-[10px] font-bold">✓</span>
                <span>Earn contributor ranking and verified byline attribution</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-300 font-medium">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#DC2626] text-white text-[10px] font-bold">✓</span>
                <span>Access our distraction-free Notion-grade writing canvas</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-300 font-medium">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#DC2626] text-white text-[10px] font-bold">✓</span>
                <span>Receive detailed 0–10 editorial feedback on every dispatch</span>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 border-t border-slate-800 pt-6 flex items-center justify-between text-xs text-slate-400">
          <span>© {new Date().getFullYear()} {SITE_NAME}</span>
          <Link href="/about" className="hover:text-white transition-colors">
            Editorial Guidelines
          </Link>
        </div>

        {/* Ambient Glow */}
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-[#DC2626]/10 rounded-full blur-[100px] pointer-events-none" />
      </div>

      {/* Right Signup Form Panel */}
      <div className="flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden mb-8 text-center">
            <Link href="/" className="inline-block">
              <Logo variant="horizontal" className="h-8 w-auto" />
            </Link>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-7 sm:p-9 shadow-2xs space-y-6">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#DC2626]">
                CORRESPONDENT NETWORK
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
                Apply for Access
              </h1>
              <p className="mt-1 text-xs text-slate-500 font-medium">
                Applications are reviewed by our editorial team to ensure verified coverage.
              </p>
            </div>

            <SignupForm />

            <div className="border-t border-slate-100 pt-4 text-center">
              <p className="text-xs text-slate-500 font-medium">
                Already an accredited correspondent?{" "}
                <Link href="/login" className="font-bold text-[#DC2626] hover:underline">
                  Log In →
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
