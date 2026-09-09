import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { getArticleById } from "@/lib/articles";
import { getCities } from "@/lib/cities";
import { getCategories } from "@/lib/categories";
import ArticleEditor from "@/components/dashboard/ArticleEditor";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Edit Article | World Attraction News",
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
      <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center space-y-3">
        <p className="text-sm font-semibold text-stone-800">
          This article has already been {article.status.replace(/_/g, " ")} and can no longer be edited.
        </p>
        <Link
          href={`/contributor/articles/${article.id}`}
          className="inline-block rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-blue-600 transition-colors"
        >
          View Article Status →
        </Link>
      </div>
    );
  }

  const [cities, categories] = await Promise.all([
    getCities(),
    getCategories(),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-stone-900">Edit Article</h1>
      <p className="mt-1 text-sm text-stone-600">Editing &ldquo;{article.title || "Untitled"}&rdquo;</p>
      <div className="mt-8 max-w-7xl">
        <ArticleEditor
          articleId={article.id}
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
            canonicalUrl: article.canonicalUrl,
            slug: article.slug,
          }}
          status={article.status}
          cities={cities.map((c) => ({ id: c.id, name: c.name, country: c.country }))}
          categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        />
      </div>
    </div>
  );
}
