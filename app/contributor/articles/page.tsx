import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getArticlesByAuthor } from "@/lib/articles";
import ArticlesList from "@/components/dashboard/ArticlesList";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "My Articles | World Attraction News",
  robots: { index: false, follow: false },
};

export default async function DashboardArticlesPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const articles = await getArticlesByAuthor(session.userId);

  return <ArticlesList articles={articles} />;
}
