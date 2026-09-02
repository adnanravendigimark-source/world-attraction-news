import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getArticlesByAuthor, summarizePoints } from "@/lib/articles";
import StatusBadge from "@/components/StatusBadge";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Dashboard Overview | World Attraction News",
  robots: { index: false, follow: false },
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
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
      className={`rounded-xl border p-4 transition-all ${
        highlight
          ? "border-rose-200 bg-rose-50/40 shadow-xs"
          : "border-slate-200 bg-white shadow-2xs hover:border-slate-300"
      }`}
    >
      <div className="flex items-center justify-between text-slate-400 mb-1.5">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
        <div className="h-6 w-6 rounded-md bg-slate-50 flex items-center justify-center text-slate-600">
          {icon}
        </div>
      </div>
      <p className="font-sans text-xl sm:text-2xl font-bold text-slate-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500 font-medium">{sub}</p>}
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
  const changesRequestedCount = articles.filter(
    (a) => a.status === "changes_requested" || a.status === "rejected"
  ).length;
  const publishedCount = articles.filter((a) => a.status === "published").length;
  const approvedOrPublished = articles.filter((a) => a.status === "approved" || a.status === "published").length;

  const recent = [...articles]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 6);

  const feedbackItems = articles
    .filter(
      (a) =>
        a.adminFeedback &&
        (a.status === "rejected" ||
          a.status === "changes_requested" ||
          a.status === "approved" ||
          a.status === "published")
    )
    .sort((a, b) => new Date(b.reviewedAt || 0).getTime() - new Date(a.reviewedAt || 0).getTime())
    .slice(0, 3);

  return (
    <div className="space-y-5">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <span className="h-2 w-2 rounded-full bg-[#DC2626]" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#DC2626]">
              CONTRIBUTOR DESK
            </span>
          </div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900">
            Welcome back, {session.displayName || "Correspondent"}
          </h1>
          <p className="mt-0.5 text-xs text-slate-500 font-medium">
            Manage your articles, review status, and submissions.
          </p>
        </div>
        <Link
          href="/dashboard/articles/new"
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#DC2626] px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-2xs hover:bg-[#B91C1C] transition-colors self-start sm:self-auto"
        >
          <span>+ Write Article</span>
        </Link>
      </div>

      {/* 4 Compact Stat Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Total Articles"
          value={articles.length}
          sub={`${draftCount} draft${draftCount === 1 ? "" : "s"}`}
          icon={
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
        />
        <StatCard
          label="Published"
          value={publishedCount}
          sub={`${approvedOrPublished} approved`}
          icon={
            <svg className="h-3.5 w-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          label="Quality Points"
          value={points.totalPoints}
          sub={points.averageScore !== null ? `Avg ${points.averageScore}/10` : "No scores"}
          icon={
            <svg className="h-3.5 w-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          }
        />
        <StatCard
          label="In Review"
          value={pendingCount}
          highlight={changesRequestedCount > 0}
          sub={changesRequestedCount > 0 ? `${changesRequestedCount} revision needed` : "Queue clear"}
          icon={
            <svg className="h-3.5 w-3.5 text-[#DC2626]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </div>

      {/* Main 2-Column Content */}
      <div className="grid gap-5 lg:grid-cols-12 items-start">
        {/* Left Column: Recent Articles List */}
        <div className="lg:col-span-8 rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Recent Articles
            </h2>
            <Link
              href="/dashboard/articles"
              className="text-xs font-semibold text-[#DC2626] hover:underline"
            >
              View All ({articles.length}) →
            </Link>
          </div>

          {recent.length === 0 ? (
            <div className="py-8 text-center bg-slate-50 rounded-lg border border-dashed border-slate-200">
              <p className="text-xs font-semibold text-slate-700">No articles created yet.</p>
              <p className="mt-0.5 text-xs text-slate-500">Draft your first article to submit to editors.</p>
              <Link
                href="/dashboard/articles/new"
                className="mt-2.5 inline-flex items-center gap-1 rounded-lg bg-[#DC2626] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#B91C1C]"
              >
                + Write Article
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recent.map((a) => (
                <Link
                  key={a.id}
                  href={a.status === "draft" ? `/dashboard/articles/${a.id}/edit` : `/dashboard/articles/${a.id}`}
                  className="group flex items-center justify-between gap-3 py-2.5 hover:bg-slate-50 transition-colors px-2 rounded-lg -mx-1"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs sm:text-sm font-semibold text-slate-900 group-hover:text-[#DC2626] transition-colors">
                      {a.title || "Untitled Draft"}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      <span className="font-semibold text-slate-700">{a.cityName || "Global"}</span> · {formatDate(a.updatedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {a.score !== null && (
                      <span className="rounded bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[10px] font-mono font-bold text-amber-800">
                        {a.score}/10
                      </span>
                    )}
                    <StatusBadge status={a.status} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Editorial Feedback */}
        <div className="lg:col-span-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-3 mb-2.5">
            Editor Feedback
          </h2>

          {feedbackItems.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center font-medium">
              No review notes yet. Once your stories are evaluated, feedback and scores will appear here.
            </p>
          ) : (
            <div className="space-y-2.5">
              {feedbackItems.map((a) => (
                <div key={a.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="truncate text-xs font-semibold text-slate-900">{a.title}</p>
                    <StatusBadge status={a.status} />
                  </div>
                  {a.score !== null && (
                    <div className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800 mb-1">
                      <span>★ Score: {a.score}/10</span>
                    </div>
                  )}
                  <p className="text-xs text-slate-600 bg-white p-2 rounded border border-slate-200 italic">
                    "{a.adminFeedback}"
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="mt-3.5 pt-2.5 border-t border-slate-100">
            <Link
              href="/dashboard/points"
              className="text-xs font-semibold text-[#DC2626] hover:underline flex items-center justify-between"
            >
              <span>View Points Ledger</span>
              <span>→</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
