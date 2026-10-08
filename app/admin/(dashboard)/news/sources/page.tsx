import type { Metadata } from "next";
import NewsSourcesManager from "@/components/admin/NewsSourcesManager";
import AccessDenied from "@/components/admin/AccessDenied";
import { getSession } from "@/lib/session";
import { getEffectivePermissions, hasPermission } from "@/lib/permissions";
import { getNewsSources, NEWS_CATEGORIES, NEWS_SOURCE_TYPES } from "@/lib/news/sources";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin News Sources", robots: { index: false, follow: false } };

export default async function AdminNewsSourcesPage() {
  const session = await getSession();
  const effective = await getEffectivePermissions(session);
  if (!hasPermission(effective, "news", "read")) {
    return <AccessDenied pageLabel="Trending News" />;
  }
  const sources = await getNewsSources();
  return (
    <NewsSourcesManager
      initialSources={sources}
      categories={[...NEWS_CATEGORIES]}
      types={NEWS_SOURCE_TYPES}
      keys={{ newsapi: !!process.env.NEWSAPI_KEY, currents: !!process.env.CURRENTS_API_KEY }}
      canEdit={hasPermission(effective, "news", "create") && hasPermission(effective, "news", "update")}
    />
  );
}
