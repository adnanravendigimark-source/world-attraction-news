import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getArticlesByAuthor, summarizePoints } from "@/lib/articles";
import StatusBadge from "@/components/StatusBadge";

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
  const scoredArticles = articles
    .filter((a) => a.score !== null && a.status !== "pending" && a.status !== "rejected")
    .sort((a, b) => new Date(b.reviewedAt || 0).getTime() - new Date(a.reviewedAt || 0).getTime());

  const topScored = scoredArticles.reduce<typeof scoredArticles[0] | null>(
    (best, a) => (!best || (a.score || 0) > (best.score || 0) ? a : best),
    null
  );

  return (
    <div className="space-y-6 max-w-5xl">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 text-xl shadow-2xs">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Points &amp; Scores
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Track editorial verification scores, quality ratings, and publishing credits.
            </p>
          </div>
        </div>
      </div>

      {/* 2. KPI Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Quality Points</p>
          <p className="text-3xl font-extrabold text-slate-900">{points.totalPoints}</p>
          <p className="text-xs text-emerald-600 font-medium">Cumulative publishing points</p>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Editorial Average</p>
          <p className="text-3xl font-extrabold text-amber-600">
            {points.averageScore !== null ? `${points.averageScore} / 10` : "—"}
          </p>
          <p className="text-xs text-slate-500 font-medium">Across {scoredArticles.length} reviewed dispatches</p>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Top Scoring Dispatch</p>
          {topScored ? (
            <div>
              <p className="text-3xl font-extrabold text-[#DC2626]">{topScored.score} / 10</p>
              <p className="text-xs text-slate-500 font-medium truncate max-w-xs">{topScored.title}</p>
            </div>
          ) : (
            <div>
              <p className="text-3xl font-extrabold text-slate-400">—</p>
              <p className="text-xs text-slate-400">No scored dispatches yet</p>
            </div>
          )}
        </div>
      </div>

      {/* 3. Scored Articles Ledger Table */}
      <div className="rounded-2xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">Score Ledger &amp; Review History</h2>
          <span className="text-xs font-semibold text-slate-400 font-mono">
            {scoredArticles.length} Scored Dispatches
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50/75 border-b border-slate-200/80 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="py-3.5 px-5 min-w-[280px]">Article Title</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Score</th>
                <th className="py-3.5 px-4">Reviewed Date</th>
                <th className="py-3.5 px-4 min-w-[200px]">Editorial Feedback</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {scoredArticles.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    No articles have been scored yet. When editors review your submissions, scores will appear here.
                  </td>
                </tr>
              ) : (
                scoredArticles.map((art) => (
                  <tr key={art.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-4 px-5">
                      <Link
                        href={`/contributor/articles/${art.id}`}
                        className="font-bold text-slate-900 text-xs sm:text-sm hover:text-[#DC2626] transition-colors line-clamp-1 block"
                      >
                        {art.title}
                      </Link>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {art.cityName} Bureau · {art.categoryName || "General"}
                      </p>
                    </td>

                    <td className="py-4 px-4">
                      <StatusBadge status={art.status} />
                    </td>

                    <td className="py-4 px-4 font-mono font-bold">
                      <span className="rounded-md bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs text-amber-800">
                        {art.score}/10 ★
                      </span>
                    </td>

                    <td className="py-4 px-4 font-mono text-slate-500 text-[11px]">
                      {formatDate(art.reviewedAt || art.updatedAt)}
                    </td>

                    <td className="py-4 px-4 text-xs text-slate-600">
                      {art.adminFeedback ? (
                        <span className="italic">"{art.adminFeedback}"</span>
                      ) : (
                        <span className="text-slate-400">No written notes</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
