import type { Metadata } from "next";
import { getCategories } from "@/lib/categories";
import { getAllArticles } from "@/lib/articles";
import CategoriesManager from "@/components/admin/CategoriesManager";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Editorial Categories & Beats | World Attraction News Admin",
  robots: { index: false, follow: false },
};

export default async function AdminCategoriesPage() {
  const [categories, articles] = await Promise.all([getCategories(), getAllArticles()]);

  const counts: Record<string, number> = {};
  for (const a of articles) {
    if (!a.categoryId) continue;
    counts[a.categoryId] = (counts[a.categoryId] || 0) + 1;
  }

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
