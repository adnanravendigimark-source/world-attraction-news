import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { getArticleById } from "@/lib/articles";
import { getCities } from "@/lib/cities";
import { getCategories } from "@/lib/categories";
import ArticleEditor from "@/components/dashboard/ArticleEditor";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit Article", robots: { index: false, follow: false } };

export default async function EditArticlePage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const article = await getArticleById(params.id);
  if (!article || article.authorId !== session.userId) notFound();

  if (article.status !== "draft" && article.status !== "pending" && article.status !== "rejected") {
    return (
      <div className="mx-auto max-w-3xl">
        <p className="text-sm text-ink-600">
          This article has already been {article.status} and can no longer be edited.
        </p>
      </div>
    );
  }

  const [cities, categories] = await Promise.all([getCities(), getCategories()]);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-serif text-2xl font-bold text-ink-900">
        {article.status === "draft" ? "Continue Writing" : "Edit Article"}
      </h1>
      <div className="mt-6">
        <ArticleEditor
          articleId={article.id}
          status={article.status}
          cities={cities.map((c) => ({ id: c.id, name: c.name, country: c.country }))}
          categories={categories.map((c) => ({ id: c.id, name: c.name }))}
          initial={{
            title: article.title,
            excerpt: article.excerpt,
            contentHtml: article.contentHtml,
            cityId: article.cityId,
            categoryId: article.categoryId,
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
