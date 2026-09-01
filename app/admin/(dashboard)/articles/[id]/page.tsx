import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getArticleById } from "@/lib/articles";
import { getCities } from "@/lib/cities";
import { getCategories } from "@/lib/categories";
import ArticleReviewPanel from "@/components/admin/ArticleReviewPanel";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Review Article", robots: { index: false, follow: false } };

export default async function AdminArticleDetailPage({ params }: { params: { id: string } }) {
  const article = await getArticleById(params.id);
  if (!article) notFound();

  const [cities, categories] = await Promise.all([getCities(), getCategories()]);

  return (
    <ArticleReviewPanel
      article={article}
      cities={cities.map((c) => ({ id: c.id, name: c.name }))}
      categories={categories.map((c) => ({ id: c.id, name: c.name }))}
    />
  );
}
