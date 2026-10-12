import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getArticleById } from "@/lib/articles";
import { getCities } from "@/lib/cities";
import { getAllCountries } from "@/lib/countries";
import { getCategories } from "@/lib/categories";
import { getRevisions } from "@/lib/revisions";
import ArticleReviewPanel from "@/components/admin/ArticleReviewPanel";
import AccessDenied from "@/components/admin/AccessDenied";
import { getSession } from "@/lib/session";
import { getEffectivePermissions, hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Review Article", robots: { index: false, follow: false } };

export default async function AdminArticleDetailPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  const effective = await getEffectivePermissions(session);
  if (!hasPermission(effective, "articles", "read")) {
    return <AccessDenied pageLabel="Articles" />;
  }

  const article = await getArticleById(params.id);
  // A draft hasn't been submitted yet — it isn't something an admin
  // reviews, and it's deliberately excluded from the /admin/articles list
  // above. Guard the direct-URL path too, so there's no way to land on an
  // admin review screen for an article that was never submitted.
  // News drafts are the exception: the news pipeline creates them for the
  // admin desk itself (older ones were saved with status 'draft').
  if (!article || (article.status === "draft" && article.type !== "news")) notFound();

  const [cities, categories, revisions, countries] = await Promise.all([
    getCities(),
    getCategories(),
    getRevisions(params.id),
    getAllCountries(),
  ]);

  return (
    <ArticleReviewPanel
      article={article}
      cities={cities.map((c) => ({ id: c.id, name: c.name }))}
      countries={countries.map((c) => ({ id: c.id, name: c.name }))}
      categories={categories.map((c) => ({ id: c.id, name: c.name }))}
      revisions={revisions}
    />
  );
}
