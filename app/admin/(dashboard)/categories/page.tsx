import type { Metadata } from "next";
import { getCategories } from "@/lib/categories";
import { getArticleCountsByCategory } from "@/lib/articles";
import CategoriesManager from "@/components/admin/CategoriesManager";
import AccessDenied from "@/components/admin/AccessDenied";
import { getSession } from "@/lib/session";
import { getEffectivePermissions, hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Editorial Categories & Beats | World Attraction News Admin",
  robots: { index: false, follow: false },
};

export default async function AdminCategoriesPage() {
  const session = await getSession();
  const effective = await getEffectivePermissions(session);
  if (!hasPermission(effective, "categories", "read")) {
    return <AccessDenied pageLabel="Categories" />;
  }

  // Lightweight COUNT/GROUP BY (every status, not just published — this
  // count also gates deletion, see CategoriesManager's handleDelete), not a
  // full getAllArticles() fetch.
  const [categories, counts] = await Promise.all([getCategories(), getArticleCountsByCategory()]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
          Editorial Categories &amp; Coverage Beats
        </h1>
        <p className="mt-0.5 text-xs sm:text-sm text-slate-500 font-medium">
          Manage story classification topics (Theme Parks, Iconic Landmarks, Events, Travel Guides).
        </p>
      </div>

      <CategoriesManager initialCategories={categories} articleCounts={counts} />
    </div>
  );
}
