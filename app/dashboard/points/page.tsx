import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getArticlesByAuthor, summarizePoints } from "@/lib/articles";
import StatusBadge from "@/components/StatusBadge";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Quality Points & Score Ledger", robots: { index: false, follow: false } };

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function PointsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const articles = await getArticlesByAuthor(session.userId);
  const points = summarizePoints(articles);
  // A resubmitted article (rejected -> edited -> sent back for review)
  // goes back to 'pending' without clearing its old score/feedback — that
  // history intentionally survives so it's still visible elsewhere until
  // the new review overwrites it, but showing it here as a *current*
  // ledger entry would read as "this is your score" for a review that's
  // no longer the current one. Same exclusion the dashboard overview's
  // Editor Feedback panel already applies to its own list.
  const scoredArticles = articles
    .filter((a) => a.score !== null && a.status !== "pending")
    .sort((a, b) => new Date(b.reviewedAt || 0).getTime() - new Date(a.reviewedAt || 0).getTime());

  return (
    <div className="space-y-8">
      <div className="border-b border-ink-200/80 pb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="h-2 w-2 rounded-full bg-signal" />
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-signal">
            Contributor Recognition
          </span>
        </div>
        <h1 className="font-serif text-2xl sm:text-3xl font-black text-ink-950">
          Editorial Points &amp; Quality Scoring
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-ink-600 max-w-2xl">
          Every submitted dispatch is evaluated across accuracy, depth, and clarity, receiving a formal 0–10 score from our newsroom editors.
        </p>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-ink-200/80 bg-white p-5 shadow-card">
          <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-ink-400">Total Quality Points</p>
          <p className="mt-2 font-serif text-3xl font-black text-ink-950">{points.totalPoints}</p>
          <p className="mt-1 text-xs text-ink-500">Cumulative publishing credit</p>
        </div>
        <div className="rounded-2xl border border-ink-200/80 bg-white p-5 shadow-card">
          <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-ink-400">Editorial Average</p>
          <p className="mt-2 font-serif text-3xl font-black text-amber-700">
            {points.averageScore !== null ? `${points.averageScore}/10` : "—"}
          </p>
          <p className="mt-1 text-xs text-ink-500">Across all reviewed articles</p>
        </div>
        <div className="rounded-2xl border border-ink-200/80 bg-white p-5 shadow-card">
          <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-ink-400">Evaluated Dispatches</p>
          <p className="mt-2 font-serif text-3xl font-black text-ink-950">{points.scoredArticleCount}</p>
          <p className="mt-1 text-xs text-ink-500">Stories graded by editors</p>
        </div>
      </div>

      {/* Score History */}
      <div>
        <h2 className="font-serif text-lg font-black text-ink-900 mb-4">Evaluation Ledger</h2>
        {scoredArticles.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink-300 bg-white p-12 text-center shadow-subtle">
            <p className="font-serif text-sm font-bold text-ink-800">No scored dispatches yet.</p>
            <p className="mt-1 text-xs text-ink-500">Submit a story for review to start accumulating quality points.</p>
            <Link
              href="/dashboard/articles/new"
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-signal px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-signal-dark"
            >
              + Write Dispatch
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {scoredArticles.map((a) => (
              <Link
                key={a.id}
                href={`/dashboard/articles/${a.id}`}
                className="group block rounded-2xl border border-ink-200/80 bg-white p-5 shadow-card hover:border-ink-400 hover:shadow-lift transition-all"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-serif text-base font-bold text-ink-950 group-hover:text-signal transition-colors">
                    {a.title}
                  </p>
                  <div className="flex items-center gap-3">
                    <span className="rounded-md bg-amber-100 px-2.5 py-0.5 font-mono text-xs font-bold text-amber-900">
                      ★ {a.score}/10
                    </span>
                    <StatusBadge status={a.status} />
                  </div>
                </div>
                <p className="mt-1 text-xs font-mono text-ink-400">
                  {a.cityName} Bureau · Evaluated {formatDate(a.reviewedAt)}
                </p>
                {a.adminFeedback && (
                  <div className="mt-3 rounded-xl border border-ink-200/60 bg-paper-100 p-3 text-xs text-ink-700 leading-relaxed">
                    <span className="font-bold text-ink-900">Editor Note: </span>
                    "{a.adminFeedback}"
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
