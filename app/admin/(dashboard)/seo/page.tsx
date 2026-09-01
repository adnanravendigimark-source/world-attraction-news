import type { Metadata } from "next";
import Link from "next/link";
import { getSettings } from "@/lib/settings";
import SeoSettingsForm from "@/components/admin/SeoSettingsForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "SEO Settings", robots: { index: false, follow: false } };

export default async function AdminSeoPage() {
  const settings = await getSettings();

  return (
    <div className="max-w-2xl">
      <h1 className="font-serif text-2xl font-bold text-ink-900">SEO Settings</h1>
      <p className="mt-1 text-sm text-ink-600">
        Sitewide fallbacks used only when a page doesn't set its own SEO fields. Each article and city already has
        its own meta title, meta description, and focus keyword — manage those directly from{" "}
        <Link href="/admin/articles" className="font-semibold text-signal hover:underline">
          Articles
        </Link>{" "}
        and{" "}
        <Link href="/admin/cities" className="font-semibold text-signal hover:underline">
          Cities
        </Link>
        . Canonical URLs and slugs are also per-article, on each Article Review page.
      </p>
      <div className="mt-6 rounded-lg border border-ink-200 bg-white p-6">
        <SeoSettingsForm initial={settings} />
      </div>
    </div>
  );
}
