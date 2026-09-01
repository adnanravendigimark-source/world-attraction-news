import type { Metadata } from "next";
import Link from "next/link";
import Logo from "@/components/Logo";
import { SITE_NAME } from "@/lib/site";
import SignupForm from "@/components/auth/SignupForm";

export const metadata: Metadata = { title: `Apply to Become a Contributor | ${SITE_NAME}`, robots: { index: false, follow: false } };

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2">
          <Logo className="h-8 w-8" />
          <span className="font-serif text-lg font-bold text-ink-900">{SITE_NAME}</span>
        </Link>
        <div className="rounded-xl border border-ink-200 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="font-serif text-2xl font-bold text-ink-900">Apply to Become a Contributor</h1>
          <p className="mt-1.5 text-sm text-ink-600">
            An admin reviews every application — you'll be able to log in once your account is approved. Once
            approved, you can write about any city on the site; you'll choose which city each article belongs to
            when you submit it.
          </p>
          <div className="mt-6">
            <SignupForm />
          </div>
        </div>
      </div>
    </div>
  );
}
