import type { Metadata } from "next";
import Link from "next/link";
import { getSettings } from "@/lib/settings";
import SeoSettingsForm from "@/components/admin/SeoSettingsForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "SEO | World Attraction News Admin", robots: { index: false, follow: false } };

export default async function AdminSeoPage() {
  const settings = await getSettings();

  return (
    <div className="max-w-2xl space-y-5">
      <div className="border-b border-slate-200 pb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">SEO</h1>
          <p className="mt-0.5 text-xs sm:text-sm text-slate-500 font-medium">
            Sitewide fallbacks used only when a page doesn't set its own SEO fields. Every article and city already
            has its own meta title, description, and focus keyword — manage those from{" "}
            <Link href="/admin/articles" className="font-semibold text-[#DC2626] hover:underline">
              Articles
            </Link>{" "}
            and{" "}
            <Link href="/admin/cities" className="font-semibold text-[#DC2626] hover:underline">
              Destinations
            </Link>
            .
          </p>
        </div>
        <Link
          href="/admin/settings"
          className="shrink-0 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
        >
          Go to Settings →
        </Link>
      </div>

      <SeoSettingsForm initial={settings} />
    </div>
  );
}
