import type { Metadata } from "next";
import NewsFeed from "@/components/admin/NewsFeed";
import AccessDenied from "@/components/admin/AccessDenied";
import { getSession } from "@/lib/session";
import { getEffectivePermissions, hasPermission } from "@/lib/permissions";
import { getNewsSources, NEWS_CATEGORIES } from "@/lib/news/sources";
import { getNewsStats, listNewsRuns } from "@/lib/news/items";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin Trending News", robots: { index: false, follow: false } };

export default async function AdminNewsPage() {
  const session = await getSession();
  const effective = await getEffectivePermissions(session);
  if (!hasPermission(effective, "news", "read")) {
    return <AccessDenied pageLabel="Trending News" />;
  }
  const [stats, runs, sources] = await Promise.all([getNewsStats(), listNewsRuns(10), getNewsSources()]);
  return (
    <NewsFeed
      initialStats={stats}
      initialRuns={runs}
      sources={sources.map((s) => ({ id: s.id, name: s.name }))}
      categories={[...NEWS_CATEGORIES]}
      canEdit={hasPermission(effective, "news", "update")}
    />
  );
}
