import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getArticlesByAuthor, summarizePoints } from "@/lib/articles";
import StatusBadge from "@/components/StatusBadge";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Contributor Workspace Overview", robots: { index: false, follow: false } };

function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function StatCard({
  label,
  value,
  sub,
  highlight,
  icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  highlight?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 shadow-card transition-all ${
        highlight
          ? "border-signal/30 bg-signal-light/40"
          : "border-ink-200/80 bg-white"
      }`}
    >
      <div className="flex items-center justify-between text-ink-400">
        <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-ink-500">{label}</p>
        {icon}
      </div>
      <p className="mt-2 font-serif text-3xl font-black text-ink-950">{value}</p>
      {sub && <p className="mt-1 text-xs text-ink-500 leading-snug">{sub}</p>}
    </div>
  );
}

export default async function DashboardOverviewPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const articles = await getArticlesByAuthor(session.userId);
  const points = summarizePoints(articles);
  const draftCount = articles.filter((a) => a.status === "draft").length;
  const pendingCount = articles.filter((a) => a.status === "pending").length;
  const changesRequestedCount = articles.filter((a) => a.status === "changes_requested" || a.status === "rejected").length;
  const publishedCount = articles.filter((a) => a.status === "published").length;
  const approvedOrPublished = articles.filter((a) => a.status === "approved" || a.status === "published").length;

  const recent = [...articles]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 6);

  const feedbackItems = articles
    .filter((a) => a.adminFeedback && (a.status === "rejected" || a.status === "changes_requested" || a.status === "approved" || a.status === "published"))
    .sort((a, b) => new Date(b.reviewedAt || 0).getTime() - new Date(a.reviewedAt || 0).getTime())
    .slice(0, 3);

  return (
    <div className="space-y-8">
      {/* Contributor Welcome & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-ink-200/80 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="h-2 w-2 rounded-full bg-signal" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-signal">
              Editorial Workspace
            </span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-black text-ink-950">
            Welcome, {session.displayName || "Correspondent"}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-ink-600">
            Submit dispatches and review scores for any destination in the global network.
          </p>
        </div>
        <Link
          href="/dashboard/articles/new"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-signal px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-card hover:bg-signal-dark hover:shadow-lift transition-all self-start sm:self-auto"
        >
          <span>+ Write New Dispatch</span>
        </Link>
      </div>

      {/* KPI Metrics */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Total Articles"
          value={articles.length}
          sub={`${draftCount} active draft${draftCount === 1 ? "" : "s"}`}
        />
        <StatCard
          label="Published Dispatches"
          value={publishedCount}
          sub={`${approvedOrPublished} approved total`}
        />
        <StatCard
          label="Contributor Points"
          value={points.totalPoints}
          sub={points.averageScore !== null ? `Avg score ${points.averageScore}/10` : "No scores yet"}
        />
        <StatCard
          label="Review Queue"
          value={pendingCount}
          highlight={changesRequestedCount > 0}
          sub={changesRequestedCount > 0 ? `${changesRequestedCount} need revision` : "All caught up"}
        />
      </div>

      {/* Recent Dispatches & Feedback Grid */}
      <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        {/* Recent Dispatches */}
        <div className="rounded-2xl border border-ink-200/80 bg-white p-6 shadow-card">
          <div className="flex items-center justify-between border-b border-ink-100 pb-4">
            <div>
              <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-signal">Recent Articles</p>
              <h2 className="font-serif text-lg font-black text-ink-900">Your Working Dispatches</h2>
            </div>
            <Link href="/dashboard/articles" className="text-xs font-bold text-signal hover:underline">
              View All ({articles.length}) →
            </Link>
          </div>

          {recent.length === 0 ? (
            <div className="py-12 text-center">
              <p className="font-serif text-sm font-bold text-ink-700">No dispatches created yet.</p>
              <p className="mt-1 text-xs text-ink-400">Start drafting your first destination report today.</p>
              <Link
                href="/dashboard/articles/new"
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-ink-900 px-4 py-2 text-xs font-bold text-white hover:bg-signal"
              >
                Draft First Article →
              </Link>
            </div>
          ) : (
            <div className="mt-4 divide-y divide-ink-100">
              {recent.map((a) => (
                <Link
                  key={a.id}
                  href={a.status === "draft" ? `/dashboard/articles/${a.id}/edit` : `/dashboard/articles/${a.id}`}
                  className="group flex items-center justify-between gap-4 py-3.5 hover:bg-paper-50 transition-colors px-2 rounded-lg"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-serif text-sm font-bold text-ink-900 group-hover:text-signal transition-colors">
                      {a.title || "Untitled Draft"}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] text-ink-400">
                      {a.cityName} · Modified {formatDate(a.updatedAt)}
                    </p>
                  </div>
                  <StatusBadge status={a.status} />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Editorial Desk Feedback */}
        <div className="rounded-2xl border border-ink-200/80 bg-white p-6 shadow-card flex flex-col justify-between">
          <div>
            <div className="border-b border-ink-100 pb-4">
              <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-signal">Editorial Desk</p>
              <h2 className="font-serif text-lg font-black text-ink-900">Recent Feedback &amp; Reviews</h2>
            </div>

            {feedbackItems.length === 0 ? (
              <p className="mt-6 text-xs text-ink-400 text-center py-8">
                No editorial notes yet. Once your dispatches are reviewed, feedback and 0–10 scores appear here.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {feedbackItems.map((a) => (
                  <div key={a.id} className="rounded-xl border border-ink-200/80 bg-paper-50 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-serif text-xs font-bold text-ink-900">{a.title}</p>
                      <StatusBadge status={a.status} />
                    </div>
                    {a.score !== null && (
                      <div className="mt-2 inline-flex items-center gap-1 rounded bg-amber-100/70 px-2 py-0.5 text-[10px] font-mono font-bold text-amber-900">
                        <span>★ Score:</span>
                        <span>{a.score}/10</span>
                      </div>
                    )}
                    <p className="mt-2 text-xs leading-relaxed text-ink-700 bg-white p-3 rounded-lg border border-ink-100">
                      "{a.adminFeedback}"
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 rounded-xl border border-ink-200 bg-paper-100 p-4">
            <p className="text-xs font-bold text-ink-800">Quality Scoring Metric</p>
            <p className="mt-1 text-[11px] text-ink-500 leading-relaxed">
              Every approved article earns base points plus extra multiplier points for quality ratings above 7/10.
            </p>
            <Link href="/dashboard/points" className="mt-2 inline-block text-xs font-bold text-signal hover:underline">
              View points ledger →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
