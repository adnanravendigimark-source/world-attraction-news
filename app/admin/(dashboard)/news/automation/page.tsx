import type { Metadata } from "next";
import NewsAutomation from "@/components/admin/NewsAutomation";
import AccessDenied from "@/components/admin/AccessDenied";
import { getSession } from "@/lib/session";
import { getEffectivePermissions, hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin News Automation", robots: { index: false, follow: false } };

export default async function NewsAutomationPage() {
  const session = await getSession();
  const effective = await getEffectivePermissions(session);
  if (!hasPermission(effective, "news", "read")) return <AccessDenied pageLabel="Trending News" />;
  return <NewsAutomation canEdit={hasPermission(effective, "news", "update")} />;
}
