import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getArticlesByAuthor, summarizePoints } from "@/lib/articles";
import StatusBadge from "@/components/StatusBadge";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Points & Feedback", robots: { index: false, follow: false } };

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
    .filter((a) => a.score !== null)
    .sort((a, b) => new Date(b.reviewedAt || 0).getTime() - new Date(a.reviewedAt || 0).getTime());

  return (
    <div>
      <h1 className="font-serif text-2xl font-bold text-ink-900">Points & Feedback</h1>
      <p className="mt-1 text-sm text-ink-600">
        Every reviewed article gets a 0–10 quality score from our editorial team. Scores are how we track
        contributor quality over time.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-ink-200 bg-white p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">Total Points</p>
          <p className="mt-1.5 font-serif text-2xl font-bold text-ink-900">{points.totalPoints}</p>
        </div>
        <div className="rounded-lg border border-ink-200 bg-white p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">Average Score</p>
          <p className="mt-1.5 font-serif text-2xl font-bold text-ink-900">
            {points.averageScore !== null ? `${points.averageScore}/10` : "—"}
          </p>
        </div>
        <div className="rounded-lg border border-ink-200 bg-white p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">Articles Scored</p>
          <p className="mt-1.5 font-serif text-2xl font-bold text-ink-900">{points.scoredArticleCount}</p>
        </div>
      </div>

      <h2 className="mt-8 text-sm font-bold uppercase tracking-wide text-ink-700">Score History</h2>
      {scoredArticles.length === 0 ? (
        <p className="mt-3 text-sm text-ink-500">No scored articles yet — submit an article to start earning points.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {scoredArticles.map((a) => (
            <Link
              key={a.id}
              href={`/dashboard/articles/${a.id}`}
              className="block rounded-lg border border-ink-200 bg-white p-4 hover:border-ink-400"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-ink-900">{a.title}</p>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-ink-900 px-2 py-0.5 text-xs font-bold text-white">{a.score}/10</span>
                  <StatusBadge status={a.status} />
                </div>
              </div>
              <p className="mt-1 text-[11px] text-ink-500">
                {a.cityName} · Reviewed {formatDate(a.reviewedAt)}
              </p>
              {a.adminFeedback && <p className="mt-2 text-xs leading-relaxed text-ink-600">{a.adminFeedback}</p>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
