import type { Metadata } from "next";
import { getIndexingOverview } from "@/lib/indexing";
import IndexingManager from "@/components/admin/IndexingManager";
import AccessDenied from "@/components/admin/AccessDenied";
import { getSession } from "@/lib/session";
import { getEffectivePermissions, hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Indexing & Crawling | World Attraction News Admin",
  robots: { index: false, follow: false },
};

export default async function AdminIndexingPage() {
  const session = await getSession();
  const effective = await getEffectivePermissions(session);
  if (!hasPermission(effective, "indexing", "read")) {
    return <AccessDenied pageLabel="Indexing" />;
  }

  const rows = await getIndexingOverview();

  return (
    <div className="max-w-4xl space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Search Indexing &amp; Crawling</h1>
        <p className="mt-1 text-xs sm:text-sm text-slate-500 font-medium">
          Control search engine indexing (<code>index</code> / <code>noindex</code>) and link crawling (
          <code>follow</code> / <code>nofollow</code>) for every page, category, destination, and story across the site.
        </p>
      </div>

      <IndexingManager initial={rows} />
    </div>
  );
}
