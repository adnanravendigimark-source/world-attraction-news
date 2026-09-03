import Link from "next/link";
import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { getArticleById } from "@/lib/articles";
import StatusBadge from "@/components/StatusBadge";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Article Details | World Attraction News",
  robots: { index: false, follow: false },
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default async function ArticleDetailPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const article = await getArticleById(params.id);
  if (!article || article.authorId !== session.userId) notFound();

  if (article.status === "draft") redirect(`/contributor/articles/${article.id}/edit`);

  return (
    <div className="max-w-3xl space-y-6">
      {/* Breadcrumb */}
      <div>
        <Link
          href="/contributor/articles"
          className="text-xs font-semibold text-slate-500 hover:text-[#DC2626] transition-colors"
        >
          ← Back to My Articles
        </Link>
      </div>

      {/* Header Info */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{article.title}</h1>
          <StatusBadge status={article.status} />
        </div>

        <p className="text-xs text-slate-500 font-medium">
          <span className="font-semibold text-slate-700">{article.cityName || "Global"} Bureau</span>
          {article.categoryName ? ` · ${article.categoryName}` : ""}
          {article.submittedAt ? ` · Submitted ${formatDate(article.submittedAt)}` : ""}
          {article.reviewedAt ? ` · Reviewed ${formatDate(article.reviewedAt)}` : ""}
          {article.publishedAt ? ` · Published ${formatDate(article.publishedAt)}` : ""}
        </p>

        {/* Changes requested notice */}
        {article.status === "changes_requested" && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-900">
            <p className="font-bold">An editor requested revisions on this article:</p>
            {article.adminFeedback && <p className="mt-1 leading-relaxed">{article.adminFeedback}</p>}
          </div>
        )}

        {/* Rejected notice */}
        {article.status === "rejected" && (
          <div className="rounded-lg border border-rose-300 bg-rose-50 p-3.5 text-xs text-rose-900">
            <p className="font-bold">This submission was rejected.</p>
            {article.adminFeedback && <p className="mt-1 leading-relaxed">{article.adminFeedback}</p>}
            <p className="mt-1.5 leading-relaxed">You can edit it and resubmit for another review.</p>
          </div>
        )}

        {/* Unpublished notice */}
        {article.status === "unpublished" && (
          <div className="rounded-lg border border-slate-300 bg-slate-50 p-3.5 text-xs text-slate-700">
            <p className="font-bold">This article was taken down from the public site by an editor.</p>
            {article.adminFeedback && <p className="mt-1 leading-relaxed">{article.adminFeedback}</p>}
          </div>
        )}

        {/* Editorial Review & Score */}
        {(article.score !== null || article.adminFeedback) && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">Editorial Review</h2>
              {article.score !== null && (
                <span className="rounded bg-amber-100 border border-amber-300 px-2 py-0.5 text-xs font-mono font-bold text-amber-900">
                  ★ Score: {article.score}/10
                </span>
              )}
            </div>
            {article.adminFeedback &&
              article.status !== "changes_requested" &&
              article.status !== "rejected" &&
              article.status !== "unpublished" && (
                <p className="mt-2 text-xs leading-relaxed text-slate-700 italic">"{article.adminFeedback}"</p>
              )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-2 flex items-center gap-3">
          {(article.status === "rejected" || article.status === "changes_requested") && (
            <Link
              href={`/contributor/articles/${article.id}/edit`}
              className="inline-flex items-center gap-1 rounded-lg bg-[#DC2626] px-4 py-2 text-xs font-bold text-white hover:bg-[#B91C1C] transition-colors"
            >
              <span>Edit &amp; Resubmit</span>
              <span>→</span>
            </Link>
          )}
          {article.status === "published" && (
            <Link
              href={`/latest-news/${article.slug}`}
              target="_blank"
              className="inline-flex items-center gap-1 rounded-lg bg-[#0B1527] px-4 py-2 text-xs font-bold text-white hover:bg-[#DC2626] transition-colors"
            >
              <span>Open Live Story</span>
              <span>↗</span>
            </Link>
          )}
        </div>
      </div>

      {/* Cover Image & Article Preview Body */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xs space-y-4">
        {article.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={article.image} alt={article.imageAlt || "Cover"} className="w-full rounded-lg object-cover max-h-96" />
        )}
        <div
          className="prose prose-slate max-w-none text-slate-800 text-sm sm:text-base leading-relaxed"
          dangerouslySetInnerHTML={{ __html: article.contentHtml }}
        />
      </div>
    </div>
  );
}
