import type { Metadata } from "next";
import Link from "next/link";
import Logo from "@/components/Logo";
import { SITE_NAME, SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = { title: `Pending Approval | ${SITE_NAME}`, robots: { index: false, follow: false } };

export default function PendingApprovalPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4 py-12">
      <div className="w-full max-w-sm text-center">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2">
          <Logo className="h-8 w-8" />
          <span className="font-serif text-lg font-bold text-ink-900">{SITE_NAME}</span>
        </Link>
        <div className="rounded-xl border border-ink-200 bg-white p-8 shadow-sm">
          <p className="text-3xl">⏳</p>
          <h1 className="mt-3 font-serif text-xl font-bold text-ink-900">Your account is pending approval</h1>
          <p className="mt-3 text-sm text-ink-600">
            Thanks for applying to write for {SITE_NAME}. An admin reviews every new contributor account — you'll be
            able to log in as soon as yours is approved. This usually doesn't take long.
          </p>
          <p className="mt-3 text-xs text-ink-500">
            Questions? Reach us at{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-signal hover:underline">
              {SUPPORT_EMAIL}
            </a>
            .
          </p>
          <Link href="/login" className="mt-5 inline-block text-sm font-semibold text-signal hover:underline">
            ← Back to Log In
          </Link>
        </div>
      </div>
    </div>
  );
}
