import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { getArticleById } from "@/lib/articles";
import { getCities } from "@/lib/cities";
import { getCategories } from "@/lib/categories";
import { getAttractions } from "@/lib/attractions";
import ArticleEditor from "@/components/dashboard/ArticleEditor";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit Article", robots: { index: false, follow: false } };

const EDITABLE_STATUSES = ["draft", "pending", "rejected", "changes_requested"];

export default async function EditArticlePage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const article = await getArticleById(params.id);
  if (!article || article.authorId !== session.userId) notFound();

  if (!EDITABLE_STATUSES.includes(article.status)) {
    return (
      <div className="mx-auto max-w-3xl">
        <p className="text-sm text-ink-600">
          This article has already been {article.status.replace(/_/g, " ")} and can no longer be edited.
        </p>
      </div>
    );
  }

  const [cities, categories, attractions] = await Promise.all([getCities(), getCategories(), getAttractions()]);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-serif text-2xl font-bold text-ink-900">
        {article.status === "draft" ? "Continue Writing" : "Edit Article"}
      </h1>
      {article.status === "changes_requested" && article.adminFeedback && (
        <div className="mt-3 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-semibold">Editor feedback — changes requested:</p>
          <p className="mt-1">{article.adminFeedback}</p>
        </div>
      )}
      <div className="mt-6">
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
