import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";
import { SITE_NAME } from "@/lib/site";
import LoginForm from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: `Contributor Log In | ${SITE_NAME}`, robots: { index: false, follow: false } };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4 py-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2">
          <Logo className="h-8 w-8" />
          <span className="font-serif text-lg font-bold text-ink-900">{SITE_NAME}</span>
        </Link>
        <div className="rounded-xl border border-ink-200 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="font-serif text-2xl font-bold text-ink-900">Contributor Log In</h1>
          <p className="mt-1.5 text-sm text-ink-600">Log in to submit articles and track your submission status.</p>
          <div className="mt-6">
            <Suspense fallback={null}>
              <LoginForm />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
