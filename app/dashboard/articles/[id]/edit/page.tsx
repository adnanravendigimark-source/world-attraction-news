import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { getArticleById } from "@/lib/articles";
import { getCities } from "@/lib/cities";
import { getCategories } from "@/lib/categories";
import { getAttractions } from "@/lib/attractions";
import ArticleEditor from "@/components/dashboard/ArticleEditor";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Edit Article | Dashboard",
  robots: { index: false, follow: false },
};

const EDITABLE_STATUSES = ["draft", "pending", "rejected", "changes_requested"];

export default async function EditArticlePage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const article = await getArticleById(params.id);
  if (!article || article.authorId !== session.userId) notFound();

  if (!EDITABLE_STATUSES.includes(article.status)) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
        <p className="text-sm font-semibold text-slate-800">
          This article has already been {article.status.replace(/_/g, " ")} and can no longer be edited.
        </p>
        <Link
          href={`/dashboard/articles/${article.id}`}
          className="mt-3 inline-block text-xs font-bold text-[#DC2626] hover:underline"
        >
          View Article Status →
        </Link>
      </div>
    );
  }

  const [cities, categories, attractions] = await Promise.all([getCities(), getCategories(), getAttractions()]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <Link href="/dashboard/articles" className="hover:text-[#DC2626] transition-colors">
              My Articles
            </Link>
            <span>/</span>
            <span className="text-slate-800 font-semibold">Edit Article</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            {article.status === "draft" ? "Continue Writing Draft" : "Edit Article Submission"}
          </h1>
        </div>
      </div>

      {article.status === "changes_requested" && article.adminFeedback && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900">
          <p className="font-bold">Editor Review Notes — Changes Requested:</p>
          <p className="mt-1 leading-relaxed">{article.adminFeedback}</p>
        </div>
      )}

      <div>
        <ArticleEditor
          articleId={article.id}
          status={article.status}
          cities={cities.map((c) => ({ id: c.id, name: c.name, country: c.country }))}
          categories={categories.map((c) => ({ id: c.id, name: c.name }))}
          attractions={attractions.map((a) => ({ id: a.id, name: a.name, cityId: a.cityId }))}
          initial={{
            title: article.title,
            excerpt: article.excerpt,
            contentHtml: article.contentHtml,
            cityId: article.cityId,
            categoryId: article.categoryId,
            attractionId: article.attractionId,
            image: article.image,
            imageAlt: article.imageAlt,
            metaTitle: article.metaTitle,
            metaDescription: article.metaDescription,
            focusKeyword: article.focusKeyword,
          }}
        />
      </div>
    </div>
  );
}
