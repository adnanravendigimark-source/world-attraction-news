import Link from "next/link";
import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { getArticleById } from "@/lib/articles";
import StatusBadge from "@/components/StatusBadge";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Article Details", robots: { index: false, follow: false } };

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default async function ArticleDetailPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const article = await getArticleById(params.id);
  if (!article || article.authorId !== session.userId) notFound();

  if (article.status === "draft") redirect(`/dashboard/articles/${article.id}/edit`);

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/dashboard/articles" className="text-xs font-semibold text-ink-500 hover:underline">
        ← Back to My Articles
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="font-serif text-2xl font-bold text-ink-900">{article.title}</h1>
        <StatusBadge status={article.status} />
      </div>
      <p className="mt-1.5 text-xs text-ink-500">
        {article.cityName}
        {article.categoryName ? ` · ${article.categoryName}` : ""} · Submitted {formatDate(article.submittedAt)}
        {article.reviewedAt ? ` · Reviewed ${formatDate(article.reviewedAt)}` : ""}
        {article.publishedAt ? ` · Published ${formatDate(article.publishedAt)}` : ""}
      </p>

      {article.status === "changes_requested" && (
        <div className="mt-4 rounded-lg border border-orange-200 bg-orange-50 p-4 text-sm text-orange-900">
          <p className="font-semibold">An editor requested changes on this article.</p>
          {article.adminFeedback && <p className="mt-1.5">{article.adminFeedback}</p>}
        </div>
      )}

      {(article.score !== null || article.adminFeedback) && (
        <div className="mt-4 rounded-lg border border-ink-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wide text-ink-500">Editorial Review</h2>
            {article.score !== null && <span className="rounded bg-ink-900 px-2 py-0.5 text-xs font-bold text-white">{article.score}/10</span>}
          </div>
          {article.adminFeedback && <p className="mt-2 text-sm leading-relaxed text-ink-700">{article.adminFeedback}</p>}
        </div>
      )}

      {article.status === "scheduled" && article.scheduledAt && (
        <div className="mt-4 rounded-lg border border-purple-200 bg-purple-50 p-4 text-xs text-purple-900">
          Scheduled to publish automatically on {new Date(article.scheduledAt).toLocaleString()}.
        </div>
      )}

      {article.originalityFlag && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
          This article was flagged by our originality check for containing content similar to other articles on the
          site. It's included here so editors can review the actual submitted text alongside that flag.
        </div>
      )}

      <div className="mt-6 flex items-center gap-4">
        {(article.status === "rejected" || article.status === "changes_requested") && (
          <Link href={`/dashboard/articles/${article.id}/edit`} className="text-sm font-semibold text-signal hover:underline">
            Edit &amp; Resubmit →
          </Link>
        )}
        {article.status === "published" && (
          <Link href={`/cities/${article.citySlug}/${article.slug}`} target="_blank" className="text-sm font-semibold text-signal hover:underline">
            View Live →
          </Link>
        )}
      </div>

      {article.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={article.image} alt={article.imageAlt} className="mt-6 w-full rounded-lg object-cover" />
      )}
      <div className="article-body mt-6" dangerouslySetInnerHTML={{ __html: article.contentHtml }} />
    </div>
  );
}
