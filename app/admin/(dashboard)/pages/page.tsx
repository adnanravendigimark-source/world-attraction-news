import type { Metadata } from "next";
import { getContactPageConfig, getAboutPageConfig } from "@/lib/settings";
import PagesManager from "@/components/admin/PagesManager";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Pages | World Attraction News Admin",
  robots: { index: false, follow: false },
};

export default async function AdminPagesPage() {
  const [contactConfig, aboutConfig] = await Promise.all([getContactPageConfig(), getAboutPageConfig()]);

  return (
    <div className="space-y-5">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Pages</h1>
        <p className="mt-0.5 text-xs sm:text-sm text-slate-500 font-medium">
          Edit the content shown on the public Contact and About pages.
        </p>
      </div>

      <PagesManager initialContactConfig={contactConfig} initialAboutConfig={aboutConfig} />
    </div>
  );
}
