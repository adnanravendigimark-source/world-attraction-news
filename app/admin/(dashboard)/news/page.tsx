import type { Metadata } from "next";
import NewsDesk from "@/components/admin/NewsDesk";
import AccessDenied from "@/components/admin/AccessDenied";
import { getSession } from "@/lib/session";
import { getEffectivePermissions, hasPermission } from "@/lib/permissions";
import { getNewsStats } from "@/lib/news/items";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin Trending News", robots: { index: false, follow: false } };

export default async function AdminNewsPage() {
  const session = await getSession();
  const effective = await getEffectivePermissions(session);
  if (!hasPermission(effective, "news", "read")) {
    return <AccessDenied pageLabel="Trending News" />;
  }
  const stats = await getNewsStats();
  return <NewsDesk lastFetchAt={stats.lastRunAt} canEdit={hasPermission(effective, "news", "update")} />;
}
