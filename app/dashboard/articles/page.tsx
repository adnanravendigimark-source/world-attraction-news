import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getArticlesByAuthor } from "@/lib/articles";
import ArticlesList from "@/components/dashboard/ArticlesList";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My Articles", robots: { index: false, follow: false } };

export default async function DashboardArticlesPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const articles = await getArticlesByAuthor(session.userId);

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold text-ink-900">My Articles</h1>
          <p className="mt-1 text-sm text-ink-600">Drafts, submissions, and everything you've published.</p>
        </div>
      </div>
      <div className="mt-6">
        <ArticlesList articles={articles} />
      </div>
    </div>
  );
}
