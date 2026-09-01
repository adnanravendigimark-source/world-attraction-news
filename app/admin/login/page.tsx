import type { Metadata } from "next";
import { Suspense } from "react";
import Logo from "@/components/Logo";
import AdminLoginForm from "@/components/admin/AdminLoginForm";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = { title: "Admin Log In", robots: { index: false, follow: false } };

export default function AdminLoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-900 px-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow-lift">
        <div className="flex items-center gap-2">
          <Logo className="h-8 w-8" />
          <span className="font-serif text-lg font-bold text-ink-900">{SITE_NAME}</span>
        </div>
        <h1 className="mt-5 text-base font-bold text-ink-900">Admin Panel Log In</h1>
        <div className="mt-5">
          <Suspense fallback={null}>
            <AdminLoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
