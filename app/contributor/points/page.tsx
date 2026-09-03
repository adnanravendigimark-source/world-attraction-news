import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getArticlesByAuthor, summarizePoints } from "@/lib/articles";
import StatusBadge from "@/components/StatusBadge";
import ScoreBadge from "@/components/ScoreBadge";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Points & Scores | World Attraction News",
  robots: { index: false, follow: false },
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function PointsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const articles = await getArticlesByAuthor(session.userId);
  const points = summarizePoints(articles);
  // Mirrors summarizePoints()'s own scoring filter (lib/articles.ts) so the
  // list below only ever shows articles that actually counted toward the
  // totals above — no article can appear here without being reflected in
  // the KPI cards, and vice versa.
  const scoredArticles = articles
    .filter((a) => a.score !== null && a.status !== "pending" && a.status !== "rejected")
    .sort((a, b) => new Date(b.reviewedAt || 0).getTime() - new Date(a.reviewedAt || 0).getTime());

  const topScored = scoredArticles.reduce<typeof scoredArticles[0] | null>(
    (best, a) => (!best || (a.score || 0) > (best.score || 0) ? a : best),
    null
  );

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Page Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">Points &amp; Scores</h1>
        <p className="text-xs text-slate-500 font-medium mt-0.5">
          Your editorial scores and quality points, from every reviewed article.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Points</p>
          <p className="text-3xl font-extrabold text-slate-900">{points.totalPoints}</p>
          <p className="text-xs text-slate-500 font-medium">Across {scoredArticles.length} reviewed articles</p>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Average Score</p>
          <p className="text-3xl font-extrabold text-amber-600">
            {points.averageScore !== null ? `${points.averageScore} / 10` : "—"}
          </p>
          <p className="text-xs text-slate-500 font-medium">Editorial average</p>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Top Score</p>
          {topScored ? (
            <div>
              <p className="text-3xl font-extrabold text-[#DC2626]">{topScored.score} / 10</p>
              <p className="text-xs text-slate-500 font-medium truncate max-w-xs">{topScored.title}</p>
            </div>
          ) : (
            <div>
              <p className="text-3xl font-extrabold text-slate-300">—</p>
              <p className="text-xs text-slate-400">No scored articles yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Scored Articles List */}
      <div className="rounded-2xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">Review History</h2>
          <span className="text-xs font-semibold text-slate-400">{scoredArticles.length} scored</span>
        </div>

        {scoredArticles.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-slate-400">
              No articles have been scored yet. Once an editor reviews your submissions, scores will show up here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {scoredArticles.map((art) => (
              <div key={art.id} className="p-4 sm:p-5 hover:bg-slate-50/60 transition-colors space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/contributor/articles/${art.id}`}
                      className="block text-sm font-bold text-slate-900 hover:text-[#DC2626] transition-colors line-clamp-1"
                    >
                      {art.title}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <StatusBadge status={art.status} />
                      <span className="text-[11px] text-slate-400">
                        {art.cityName}
                        {art.categoryName ? ` · ${art.categoryName}` : ""}
                        {" · Reviewed "}
                        {formatDate(art.reviewedAt || art.updatedAt)}
                      </span>
                    </div>
                  </div>
                  <ScoreBadge score={art.score as number} />
                </div>
                {art.adminFeedback && (
                  <p className="text-xs text-slate-600 italic pl-0.5">&ldquo;{art.adminFeedback}&rdquo;</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
