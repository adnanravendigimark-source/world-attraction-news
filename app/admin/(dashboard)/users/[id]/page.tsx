import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findUserById, toSafeUser } from "@/lib/users";
import { getArticlesByAuthor, summarizePoints } from "@/lib/articles";
import StatusBadge from "@/components/StatusBadge";
import UserDetailPanel from "@/components/admin/UserDetailPanel";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Contributor Details | World Attraction News Admin",
  robots: { index: false, follow: false },
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function AdminUserDetailPage({ params }: { params: { id: string } }) {
  const user = await findUserById(params.id);
  if (!user) notFound();

  const articles = await getArticlesByAuthor(user.id);
  const points = summarizePoints(articles);
  const feedbackHistory = articles
    .filter((a) => a.adminFeedback)
    .sort((a, b) => new Date(b.reviewedAt || 0).getTime() - new Date(a.reviewedAt || 0).getTime());

  const counts = {
    total: articles.length,
    published: articles.filter((a) => a.status === "published").length,
    pending: articles.filter((a) => a.status === "pending").length,
    rejected: articles.filter((a) => a.status === "rejected").length,
    draft: articles.filter((a) => a.status === "draft").length,
  };

  return (
    <div className="max-w-4xl space-y-5">
      {/* Breadcrumb Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2 text-xs">
          <Link
            href="/admin/users"
            className="font-semibold text-slate-500 hover:text-[#DC2626] transition-colors"
          >
            ← Back to Contributors
          </Link>
          <span className="text-slate-300">|</span>
          <span className="text-slate-700 font-bold">{user.displayName || user.email}</span>
        </div>
        <StatusBadge status={user.status} />
      </div>

      {/* Contributor Profile Header Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="h-12 w-12 rounded-full bg-[#0B1527] text-white flex items-center justify-center font-bold text-base shrink-0">
              {user.displayName?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || "U"}
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{user.displayName || "(No Name Set)"}</h1>
              <p className="text-xs text-slate-500 font-medium">{user.email}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            <span>📅 Registered {formatDate(user.createdAt)}</span>
            <span>•</span>
            <span>Last active {formatDate(user.lastLoginAt)}</span>
          </div>
        </div>

        {user.bio && (
          <div className="rounded-lg bg-slate-50 p-3.5 text-xs text-slate-700 leading-relaxed border border-slate-100">
            <span className="font-bold text-slate-900 block mb-0.5">Author Biography:</span>
            {user.bio}
          </div>
        )}

        <UserDetailPanel user={toSafeUser(user)} />
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Dispatches</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{counts.total}</p>
          <p className="mt-0.5 text-xs text-slate-400 font-medium">{counts.draft} in draft</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Live Published</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">{counts.published}</p>
          <p className="mt-0.5 text-xs text-slate-400 font-medium">Public on wire</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Pending Review</p>
          <p className="mt-1 text-2xl font-bold text-[#DC2626]">{counts.pending}</p>
          <p className="mt-0.5 text-xs text-slate-400 font-medium">{counts.rejected} rejected</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Quality Score</p>
          <p className="mt-1 text-2xl font-bold text-amber-700">
            {points.averageScore !== null ? `${points.averageScore}/10` : "—"}
          </p>
          <p className="mt-0.5 text-xs text-slate-400 font-medium">{points.totalPoints} points awarded</p>
        </div>
      </div>

      {/* Dispatches Written by this Author */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
            Dispatches by this Contributor ({articles.length})
          </h2>
        </div>

        {articles.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-400 font-medium">
            This writer has not submitted any articles yet.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {articles.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/admin/articles/${a.id}`}
                    className="font-bold text-sm text-slate-900 hover:text-[#DC2626] transition-colors truncate block"
                  >
                    {a.title || "Untitled Draft"}
                  </Link>
                  <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                    {a.cityName || "Global"} Bureau · {formatDate(a.submittedAt || a.updatedAt)}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {a.score !== null && (
                    <span className="rounded bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[10px] font-mono font-bold text-amber-900">
                      ★ {a.score}/10
                    </span>
                  )}
                  <StatusBadge status={a.status} />
                  <Link
                    href={`/admin/articles/${a.id}`}
                    className="rounded bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                  >
                    Review →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Editorial Feedback & Review Notes History */}
      {feedbackHistory.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xs space-y-3">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Editorial Review Notes Given ({feedbackHistory.length})
            </h2>
          </div>

          <div className="space-y-2.5">
            {feedbackHistory.map((a) => (
              <div key={a.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-900">{a.title}</span>
                  <StatusBadge status={a.status} />
                </div>
                <p className="text-slate-700 italic bg-white p-2 rounded border border-slate-100">
                  "{a.adminFeedback}"
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
