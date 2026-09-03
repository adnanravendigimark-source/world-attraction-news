import type { Metadata } from "next";
import Link from "next/link";
import Logo from "@/components/Logo";
import { SITE_NAME, SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: `Pending Approval | ${SITE_NAME}`,
  robots: { index: false, follow: false },
};

export default function PendingApprovalPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md space-y-6 text-center">
        <Link href="/" className="inline-block">
          <Logo variant="horizontal" className="h-8 w-auto" />
        </Link>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-2xs space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-800 text-2xl font-bold">
            ⏳
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Application Under Editorial Review</h1>
            <p className="mt-2 text-xs text-slate-600 leading-relaxed">
              Thank you for applying to write for <strong>{SITE_NAME}</strong>. Our editorial team reviews every correspondent registration to verify credentials. You will be able to log in as soon as your account is approved.
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500 border border-slate-100">
            Questions? Contact editorial at{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="font-bold text-[#DC2626] hover:underline">
              {SUPPORT_EMAIL}
            </a>
          </div>

          <div className="pt-2">
            <Link
              href="/login"
              className="inline-block rounded-xl bg-[#0B1527] px-4 py-2 text-xs font-bold text-white hover:bg-[#DC2626] transition-colors"
            >
              ← Return to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
