import type { Metadata } from "next";
import { getSitemaps, getUrlsForSitemap } from "@/lib/sitemaps";
import SitemapsManager from "@/components/admin/SitemapsManager";
import AccessDenied from "@/components/admin/AccessDenied";
import { getSession } from "@/lib/session";
import { getEffectivePermissions, hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Sitemaps | World Attraction News Admin",
  robots: { index: false, follow: false },
};

export default async function AdminSitemapsPage() {
  const session = await getSession();
  const effective = await getEffectivePermissions(session);
  if (!hasPermission(effective, "sitemaps", "read")) {
    return <AccessDenied pageLabel="Sitemaps" />;
  }

  const sitemaps = await getSitemaps();

  // URL counts per row, computed via the exact same type-scoped query each
  // live route uses (lib/sitemaps.ts's getUrlsForSitemap) — never a
  // fabricated or cached number, and never mixing content types together.
  const urlCounts: Record<string, number> = {};
  await Promise.all(
    sitemaps.map(async (s) => {
      const urls = await getUrlsForSitemap(s);
      urlCounts[s.id] = urls.length;
    })
  );

  return (
    <div className="space-y-5">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Sitemaps</h1>
        <p className="mt-0.5 text-xs sm:text-sm text-slate-500 font-medium">
          Manage the master sitemap index and its child sitemaps. Each sitemap is strictly typed —
          a Country sitemap can only ever contain Country URLs, an Article sitemap only published
          Article URLs, and so on.
        </p>
      </div>

      <SitemapsManager initialSitemaps={sitemaps} urlCounts={urlCounts} />
    </div>
  );
}
