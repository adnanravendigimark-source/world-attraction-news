import type { Metadata } from "next";
import BlogTopics from "@/components/admin/BlogTopics";
import AccessDenied from "@/components/admin/AccessDenied";
import { getSession } from "@/lib/session";
import { getEffectivePermissions, hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin Travel Blogs", robots: { index: false, follow: false } };

export default async function AdminBlogsPage() {
  const session = await getSession();
  const effective = await getEffectivePermissions(session);
  if (!hasPermission(effective, "news", "read")) return <AccessDenied pageLabel="Travel Blogs" />;
  return <BlogTopics canEdit={hasPermission(effective, "news", "update")} />;
}
