import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";
import { SITE_NAME } from "@/lib/site";
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";

export const metadata: Metadata = {
  title: `Reset Your Password | ${SITE_NAME}`,
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Link href="/" className="inline-block">
            <Logo variant="horizontal" className="h-8 w-auto" />
          </Link>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-7 sm:p-9 shadow-2xs space-y-5">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#DC2626]">
              ACCOUNT RECOVERY
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
              Reset Password
            </h1>
            <p className="mt-1 text-xs text-slate-500 font-medium">
              Enter your registered email address and we will send you a secure reset link.
            </p>
          </div>

          <Suspense fallback={<div className="text-xs text-slate-400 text-center py-4">Loading...</div>}>
            <ForgotPasswordForm />
          </Suspense>

          <div className="border-t border-slate-100 pt-4 text-center">
            <Link href="/login" className="text-xs font-bold text-[#DC2626] hover:underline">
              ← Back to Log In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
