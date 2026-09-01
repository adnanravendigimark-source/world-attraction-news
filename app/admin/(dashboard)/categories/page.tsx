import type { Metadata } from "next";
import { getCategories } from "@/lib/categories";
import { getAllArticles } from "@/lib/articles";
import CategoriesManager from "@/components/admin/CategoriesManager";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Categories", robots: { index: false, follow: false } };

export default async function AdminCategoriesPage() {
  const [categories, articles] = await Promise.all([getCategories(), getAllArticles()]);

  const counts: Record<string, number> = {};
  for (const a of articles) {
    if (!a.categoryId) continue;
    counts[a.categoryId] = (counts[a.categoryId] || 0) + 1;
  }

  return (
    <div>
      <h1 className="font-serif text-2xl font-bold text-ink-900">Categories</h1>
      <p className="mt-1 text-sm text-ink-600">
        Used to tag articles (e.g. Ticket &amp; Pricing, Openings &amp; Closures) and filter city pages.
      </p>
      <div className="mt-6">
        <CategoriesManager initialCategories={categories} articleCounts={counts} />
      </div>
    </div>
  );
}
