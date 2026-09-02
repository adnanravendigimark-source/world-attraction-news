import Link from "next/link";
import type { Metadata } from "next";
import { getAllArticles, summarizePoints } from "@/lib/articles";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Points & Scoring", robots: { index: false, follow: false } };

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function AdminPointsPage() {
  const articles = await getAllArticles();
  // Same "live score only" rule as the contributor's own Points page
  // (lib/articles.ts's summarizePoints) — a 'rejected' article's score
  // isn't a points-worthy result, and a resubmitted 'pending' article's
  // score is stale leftover from before it was edited, so both are
  // excluded here to actually match the "same data" this page claims to
  // mirror.
  const scored = articles
    .filter((a) => a.score !== null && a.status !== "pending" && a.status !== "rejected")
    .sort((a, b) => new Date(b.reviewedAt || 0).getTime() - new Date(a.reviewedAt || 0).getTime());

  const byAuthor = new Map<string, { name: string; email: string; articles: typeof scored }>();
  for (const a of scored) {
    if (!byAuthor.has(a.authorEmail)) byAuthor.set(a.authorEmail, { name: a.authorName, email: a.authorEmail, articles: [] });
    byAuthor.get(a.authorEmail)!.articles.push(a);
  }
  const leaderboard = Array.from(byAuthor.values())
    .map((u) => ({ ...u, summary: summarizePoints(u.articles) }))
    .sort((a, b) => b.summary.totalPoints - a.summary.totalPoints);

  return (
    <div>
      <h1 className="font-serif text-2xl font-bold text-ink-900">Points &amp; Scoring</h1>
      <p className="mt-1 text-sm text-ink-600">
        Every score given from an Article Review page appears here immediately — this reads live from the database,
        the same data each contributor sees on their own Points page.
      </p>

      <h2 className="mt-8 text-sm font-bold uppercase tracking-wide text-ink-700">Leaderboard</h2>
      {leaderboard.length === 0 ? (
        <p className="mt-3 text-sm text-ink-500">No scored articles yet.</p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-lg border border-ink-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-ink-200 bg-ink-50 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-4 py-2.5">Contributor</th>
                <th className="px-4 py-2.5">Articles Scored</th>
                <th className="px-4 py-2.5">Total Points</th>
                <th className="px-4 py-2.5">Average Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {leaderboard.map((u) => (
                <tr key={u.email}>
                  <td className="px-4 py-2.5">
                    <p className="font-semibold text-ink-900">{u.name}</p>
                    <p className="text-xs text-ink-500">{u.email}</p>
                  </td>
                  <td className="px-4 py-2.5 text-ink-700">{u.summary.scoredArticleCount}</td>
                  <td className="px-4 py-2.5 font-semibold text-ink-900">{u.summary.totalPoints}</td>
                  <td className="px-4 py-2.5 text-ink-700">{u.summary.averageScore ?? "—"}/10</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="mt-8 text-sm font-bold uppercase tracking-wide text-ink-700">Score History</h2>
      {scored.length === 0 ? (
        <p className="mt-3 text-sm text-ink-500">No scores recorded yet.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {scored.map((a) => (
            <Link key={a.id} href={`/admin/articles/${a.id}`} className="block rounded-lg border border-ink-200 bg-white p-4 hover:border-ink-400">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-ink-900">{a.title}</p>
                  <p className="mt-0.5 text-[11px] text-ink-500">
                    By {a.authorName} · {a.cityName} · Reviewed {formatDate(a.reviewedAt)}
                  </p>
                </div>
                <span className="rounded bg-ink-900 px-2 py-0.5 text-xs font-bold text-white">{a.score}/10</span>
              </div>
              {a.adminFeedback && <p className="mt-2 text-xs leading-relaxed text-ink-600">{a.adminFeedback}</p>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
