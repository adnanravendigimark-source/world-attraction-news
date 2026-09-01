import type { Metadata } from "next";
import { Suspense } from "react";
import { getAllArticles } from "@/lib/articles";
import { getCities } from "@/lib/cities";
import { getCategories } from "@/lib/categories";
import ArticlesQueue from "@/components/admin/ArticlesQueue";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Articles", robots: { index: false, follow: false } };

export default async function AdminArticlesPage() {
  const [nonDraftArticles, draftArticles, cities, categories] = await Promise.all([
    getAllArticles(),
    getAllArticles("draft"),
    getCities(),
    getCategories(),
  ]);
  const articles = [...nonDraftArticles, ...draftArticles];

  return (
    <div>
      <h1 className="font-serif text-2xl font-bold text-ink-900">Articles</h1>
      <p className="mt-1 text-sm text-ink-600">Review submissions, score and give feedback, then approve/publish.</p>
      <div className="mt-6">
        <Suspense fallback={null}>
          <ArticlesQueue initialArticles={articles} cities={cities} categories={categories} />
        </Suspense>
      </div>
    </div>
  );
}
