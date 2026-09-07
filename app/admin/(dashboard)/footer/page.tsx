import type { Metadata } from "next";
import { getFooterConfig } from "@/lib/settings";
import FooterManager from "@/components/admin/FooterManager";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Footer | World Attraction News Admin",
  robots: { index: false, follow: false },
};

export default async function AdminFooterPage() {
  const config = await getFooterConfig();

  return (
    <div className="space-y-5">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Footer</h1>
        <p className="mt-0.5 text-xs sm:text-sm text-slate-500 font-medium">
          Edit everything shown in the public site&apos;s footer — the About text, social links,
          link columns, and copyright line.
        </p>
      </div>

      <FooterManager initialConfig={config} />
    </div>
  );
}
