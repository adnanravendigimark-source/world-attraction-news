import Link from "next/link";
import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { getArticleById } from "@/lib/articles";
import StatusBadge from "@/components/StatusBadge";
import ScoreBadge from "@/components/ScoreBadge";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Article Details | World Attraction News",
  robots: { index: false, follow: false },
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function formatViews(n: number) {
  return n > 999 ? `${(n / 1000).toFixed(1)}K` : String(n);
}

export default async function ArticleDetailPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const article = await getArticleById(params.id);
  if (!article || article.authorId !== session.userId) notFound();

  // A draft has nothing to "view" yet — the editor is the only meaningful
  // place for it, matching the same status guard everywhere else that
  // touches drafts (ArticlesList.tsx, the PATCH/DELETE routes).
  if (article.status === "draft") redirect(`/contributor/articles/${article.id}/edit`);

  const showFeedbackInReview =
    article.adminFeedback &&
    article.status !== "changes_requested" &&
    article.status !== "rejected" &&
    article.status !== "unpublished";

  return (
    <div className="max-w-5xl space-y-6">
      {/* Breadcrumb */}
      <Link
        href="/contributor/articles"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#DC2626] transition-colors"
      >
        ← Back to My Articles
      </Link>

      {/* Header */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
            {article.title}
          </h1>
          <StatusBadge status={article.status} size="md" />
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 font-medium">
          <span className="font-semibold text-slate-700">{article.cityName || "Global"}</span>
          {article.categoryName && <span>· {article.categoryName}</span>}
          {article.submittedAt && <span>· Submitted {formatDate(article.submittedAt)}</span>}
          {article.reviewedAt && <span>· Reviewed {formatDate(article.reviewedAt)}</span>}
          {article.publishedAt && <span>· Published {formatDate(article.publishedAt)}</span>}
        </div>

        {/* Status-specific notices */}
        {article.status === "changes_requested" && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-bold">An editor requested revisions on this article.</p>
            {article.adminFeedback && <p className="mt-1.5 leading-relaxed">{article.adminFeedback}</p>}
          </div>
        )}
        {article.status === "rejected" && (
          <div className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900">
            <p className="font-bold">This submission was rejected.</p>
            {article.adminFeedback && <p className="mt-1.5 leading-relaxed">{article.adminFeedback}</p>}
            <p className="mt-1.5 leading-relaxed">You can edit it and resubmit for another review.</p>
          </div>
        )}
        {article.status === "unpublished" && (
          <div className="rounded-xl border border-slate-300 bg-slate-50 p-4 text-sm text-slate-700">
            <p className="font-bold">This article was taken down from the public site by an editor.</p>
            {article.adminFeedback && <p className="mt-1.5 leading-relaxed">{article.adminFeedback}</p>}
          </div>
        )}

        {/* Actions */}
        {(article.status === "rejected" || article.status === "changes_requested" || article.status === "published") && (
          <div className="pt-1 flex flex-wrap items-center gap-3">
            {(article.status === "rejected" || article.status === "changes_requested") && (
              <Link
                href={`/contributor/articles/${article.id}/edit`}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#DC2626] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#B91C1C] transition-colors"
              >
                Edit &amp; Resubmit →
              </Link>
            )}
            {article.status === "published" && (
              <Link
                href={`/cities/${article.citySlug}/${article.slug}`}
                target="_blank"
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#0B1527] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#DC2626] transition-colors"
              >
                Open Live Story ↗
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Stats: Views · Score · Word Count · Reading Time */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-2xs text-center">
          <p className="text-xl sm:text-2xl font-extrabold text-slate-900">{formatViews(article.viewCount)}</p>
          <p className="text-[11px] font-semibold text-slate-400 mt-0.5">👁 Views</p>
        </div>
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-2xs text-center">
          {article.score !== null ? (
            <ScoreBadge score={article.score} size="md" />
          ) : (
            <p className="text-xl sm:text-2xl font-extrabold text-slate-300">—</p>
          )}
          <p className="text-[11px] font-semibold text-slate-400 mt-1.5">Editorial Score</p>
        </div>
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-2xs text-center">
          <p className="text-xl sm:text-2xl font-extrabold text-slate-900">{article.wordCount.toLocaleString()}</p>
          <p className="text-[11px] font-semibold text-slate-400 mt-0.5">Words</p>
        </div>
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-2xs text-center">
          <p className="text-xl sm:text-2xl font-extrabold text-slate-900">{article.readingTimeMinutes} min</p>
          <p className="text-[11px] font-semibold text-slate-400 mt-0.5">Reading Time</p>
        </div>
      </div>

      {/* Editorial feedback (approved/published/scheduled/under_review with a note) */}
      {showFeedbackInReview && (
        <div className="rounded-2xl border border-slate-200/90 bg-slate-50 p-5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Editorial Note</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-700 italic">&ldquo;{article.adminFeedback}&rdquo;</p>
        </div>
      )}

      {/* Cover Image & Content */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-10 shadow-2xs space-y-6">
        {article.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={article.image}
            alt={article.imageAlt || "Cover"}
            className="w-full max-h-[28rem] rounded-xl object-cover"
          />
        )}
        {/* `.rich-content .article-body` — the same real typography this
            content was written/previewed with (see ArticlePreviewModal.tsx
            and ArticleReviewPanel.tsx). `prose prose-slate` is a no-op in
            this project — @tailwindcss/typography isn't installed. */}
        <div
          className="rich-content article-body text-slate-800"
          dangerouslySetInnerHTML={{ __html: article.contentHtml }}
        />
      </div>
    </div>
  );
}
