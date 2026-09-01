import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findUserById, toSafeUser } from "@/lib/users";
import { getArticlesByAuthor, summarizePoints } from "@/lib/articles";
import StatusBadge from "@/components/StatusBadge";
import UserDetailPanel from "@/components/admin/UserDetailPanel";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "User Details", robots: { index: false, follow: false } };

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
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
    <div className="mx-auto max-w-3xl">
      <Link href="/admin/users" className="text-xs font-semibold text-ink-500 hover:text-ink-800">
        ← Back to Users
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="font-serif text-2xl font-bold text-ink-900">{user.displayName || "(no name)"}</h1>
      </div>
      <p className="mt-1 text-sm text-ink-600">{user.email}</p>
      <p className="mt-1 text-xs text-ink-500">
        Registered {formatDate(user.createdAt)} · Last login {formatDate(user.lastLoginAt)}
        {user.authProvider === "google" ? " · Signed up with Google" : ""}
      </p>
      {user.bio && <p className="mt-3 text-sm text-ink-700">{user.bio}</p>}

      <div className="mt-6">
        <UserDetailPanel user={toSafeUser(user)} />
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-lg border border-ink-200 bg-white p-4">
          <p className="text-2xl font-bold text-ink-900">{counts.total}</p>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-ink-500">Total Articles</p>
        </div>
        <div className="rounded-lg border border-ink-200 bg-white p-4">
          <p className="text-2xl font-bold text-ink-900">{counts.published}</p>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-ink-500">Published</p>
        </div>
        <div className="rounded-lg border border-ink-200 bg-white p-4">
          <p className="text-2xl font-bold text-ink-900">{counts.pending}</p>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-ink-500">Pending</p>
        </div>
        <div className="rounded-lg border border-ink-200 bg-white p-4">
          <p className="text-2xl font-bold text-ink-900">{counts.rejected}</p>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-ink-500">Rejected</p>
        </div>
        <div className="rounded-lg border border-ink-200 bg-white p-4">
          <p className="text-2xl font-bold text-ink-900">{points.totalPoints}</p>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
            Total Points{points.averageScore !== null ? ` (avg ${points.averageScore})` : ""}
          </p>
        </div>
      </div>

      <h2 className="mt-8 text-sm font-bold uppercase tracking-wide text-ink-700">Article History</h2>
      {articles.length === 0 ? (
        <p className="mt-3 text-sm text-ink-500">No articles submitted yet.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {articles.map((a) => (
            <Link
              key={a.id}
              href={a.status === "draft" ? "#" : `/admin/articles/${a.id}`}
              className={`flex items-center justify-between gap-3 rounded-lg border border-ink-200 bg-white p-3.5 ${
                a.status === "draft" ? "cursor-default opacity-70" : "hover:border-ink-400"
              }`}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink-900">{a.title || "Untitled draft"}</p>
                <p className="mt-0.5 text-[11px] text-ink-500">
                  {a.cityName} · Updated {formatDate(a.updatedAt)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {a.score !== null && <span className="text-xs font-semibold text-ink-600">{a.score}/10</span>}
                <StatusBadge status={a.status} />
              </div>
            </Link>
          ))}
        </div>
      )}

      <h2 className="mt-8 text-sm font-bold uppercase tracking-wide text-ink-700">Admin Feedback History</h2>
      {feedbackHistory.length === 0 ? (
        <p className="mt-3 text-sm text-ink-500">No feedback given yet.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {feedbackHistory.map((a) => (
            <div key={a.id} className="rounded-lg border border-ink-200 bg-white p-3.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-ink-900">{a.title}</p>
                {a.score !== null && <span className="text-xs font-semibold text-ink-600">{a.score}/10</span>}
              </div>
              <p className="mt-1 text-[11px] text-ink-500">Reviewed {formatDate(a.reviewedAt)}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-700">{a.adminFeedback}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
