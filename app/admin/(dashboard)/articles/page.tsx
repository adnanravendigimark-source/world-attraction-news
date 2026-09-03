import type { Metadata } from "next";
import { Suspense } from "react";
import { getAllArticles } from "@/lib/articles";
import { getCities } from "@/lib/cities";
import { getCategories } from "@/lib/categories";
import ArticlesQueue from "@/components/admin/ArticlesQueue";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Articles Management | World Attraction News Admin",
  robots: { index: false, follow: false },
};

export default async function AdminArticlesPage() {
  // getAllArticles() with no filter already excludes 'draft' (see its own
  // comment in lib/articles.ts) — a draft hasn't been submitted, so an
  // admin has nothing to review yet. Deliberately not fetching drafts here
  // at all: this list is "what's been submitted for review", full stop.
  const [articles, cities, categories] = await Promise.all([getAllArticles(), getCities(), getCategories()]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            Articles Management
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-slate-500 font-medium">
            Review submissions, assign quality scores, evaluate originality, and publish dispatches.
          </p>
        </div>
        <Link
          href="/contributor/articles/new"
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#DC2626] px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-2xs hover:bg-[#B91C1C] transition-colors self-start sm:self-auto"
        >
          <span>+ Write Article</span>
        </Link>
      </div>

      <div>
        <Suspense fallback={<div className="p-8 text-center text-xs text-slate-400">Loading articles...</div>}>
          <ArticlesQueue initialArticles={articles} cities={cities} categories={categories} />
        </Suspense>
      </div>
    </div>
  );
}
