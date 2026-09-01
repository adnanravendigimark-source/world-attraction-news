import Link from "next/link";
import type { Metadata } from "next";
import { getAllArticles, summarizePoints } from "@/lib/articles";
import { getUsers } from "@/lib/users";
import { getCities } from "@/lib/cities";
import { getCategories } from "@/lib/categories";
import StatusBadge from "@/components/StatusBadge";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin Overview", robots: { index: false, follow: false } };

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function StatCard({ label, value, href, urgent }: { label: string; value: number | string; href?: string; urgent?: boolean }) {
  const inner = (
    <div
      className={`rounded-lg border bg-white p-4 shadow-card transition-shadow ${
        href ? "hover:shadow-lift" : ""
      } ${urgent ? "border-signal-border" : "border-ink-200"}`}
    >
      <p className={`text-2xl font-bold ${urgent ? "text-signal" : "text-ink-900"}`}>{value}</p>
      <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-ink-500">{label}</p>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export default async function AdminOverviewPage() {
  const [nonDraftArticles, draftArticles, users, cities, categories] = await Promise.all([
    getAllArticles(),
    getAllArticles("draft"),
    getUsers(),
    getCities(),
    getCategories(),
  ]);
  const articles = [...nonDraftArticles, ...draftArticles];

  const usersByStatus = {
    pending: users.filter((u) => u.status === "pending").length,
    approved: users.filter((u) => u.status === "approved").length,
    rejected: users.filter((u) => u.status === "rejected").length,
    suspended: users.filter((u) => u.status === "suspended").length,
  };
  const articlesByStatus = {
    draft: draftArticles.length,
    pending: nonDraftArticles.filter((a) => a.status === "pending").length,
    approved: nonDraftArticles.filter((a) => a.status === "approved").length,
    rejected: nonDraftArticles.filter((a) => a.status === "rejected").length,
    published: nonDraftArticles.filter((a) => a.status === "published").length,
  };

  const points = summarizePoints(articles);

  const recentUsers = [...users].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);
  const recentSubmissions = [...nonDraftArticles]
    .filter((a) => a.submittedAt)
    .sort((a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime())
    .slice(0, 5);
  const awaitingReview = nonDraftArticles.filter((a) => a.status === "pending").slice(0, 6);
  const recentlyPublished = [...nonDraftArticles]
    .filter((a) => a.status === "published")
    .sort((a, b) => new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-2xl font-bold text-ink-900">Overview</h1>
        <p className="mt-1 text-sm text-ink-600">Everything below is read live from the database on every load.</p>
      </div>

      <div>
        <h2 className="text-xs font-bold uppercase tracking-wide text-ink-500">Users</h2>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <StatCard label="Total Users" value={users.length} href="/admin/users" />
          <StatCard label="Pending" value={usersByStatus.pending} href="/admin/users?status=pending" urgent={usersByStatus.pending > 0} />
          <StatCard label="Approved" value={usersByStatus.approved} href="/admin/users?status=approved" />
          <StatCard label="Rejected" value={usersByStatus.rejected} href="/admin/users?status=rejected" />
          <StatCard label="Suspended" value={usersByStatus.suspended} href="/admin/users?status=suspended" />
        </div>
      </div>

      <div>
        <h2 className="text-xs font-bold uppercase tracking-wide text-ink-500">Articles</h2>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-6">
          <StatCard label="Total" value={articles.length} href="/admin/articles" />
          <StatCard label="Draft" value={articlesByStatus.draft} />
          <StatCard label="Pending" value={articlesByStatus.pending} href="/admin/articles?status=pending" urgent={articlesByStatus.pending > 0} />
          <StatCard label="Approved" value={articlesByStatus.approved} href="/admin/articles?status=approved" />
          <StatCard label="Rejected" value={articlesByStatus.rejected} href="/admin/articles?status=rejected" />
          <StatCard label="Published" value={articlesByStatus.published} href="/admin/articles?status=published" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Cities" value={cities.length} href="/admin/cities" />
        <StatCard label="Categories" value={categories.length} href="/admin/categories" />
        <StatCard label="Total Points Awarded" value={points.totalPoints} href="/admin/points" />
        <StatCard label="Average Score" value={points.averageScore !== null ? `${points.averageScore}/10` : "—"} href="/admin/points" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide text-ink-700">Articles Awaiting Review</h2>
            <Link href="/admin/articles?status=pending" className="text-xs font-semibold text-signal hover:underline">
              View all →
            </Link>
          </div>
          {awaitingReview.length === 0 ? (
            <p className="mt-3 text-sm text-ink-500">Nothing waiting — all caught up.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {awaitingReview.map((a) => (
                <Link key={a.id} href={`/admin/articles/${a.id}`} className="flex items-center justify-between gap-3 rounded-lg border border-ink-200 bg-white p-3.5 hover:border-ink-400">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink-900">{a.title}</p>
                    <p className="mt-0.5 text-[11px] text-ink-500">
                      By {a.authorName} · {a.cityName} · Submitted {formatDate(a.submittedAt)}
                    </p>
                  </div>
                  <StatusBadge status={a.status} />
                </Link>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink-700">Recently Published</h2>
          {recentlyPublished.length === 0 ? (
            <p className="mt-3 text-sm text-ink-500">No published articles yet.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {recentlyPublished.map((a) => (
                <Link key={a.id} href={`/admin/articles/${a.id}`} className="flex items-center justify-between gap-3 rounded-lg border border-ink-200 bg-white p-3.5 hover:border-ink-400">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink-900">{a.title}</p>
                    <p className="mt-0.5 text-[11px] text-ink-500">
                      {a.cityName} · Published {formatDate(a.publishedAt)}
                    </p>
                  </div>
                  {a.score !== null && <span className="shrink-0 text-xs font-semibold text-ink-600">{a.score}/10</span>}
                </Link>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide text-ink-700">Recent Registrations</h2>
            <Link href="/admin/users" className="text-xs font-semibold text-signal hover:underline">
              View all →
            </Link>
          </div>
          {recentUsers.length === 0 ? (
            <p className="mt-3 text-sm text-ink-500">No registrations yet.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {recentUsers.map((u) => (
                <Link key={u.id} href={`/admin/users/${u.id}`} className="flex items-center justify-between gap-3 rounded-lg border border-ink-200 bg-white p-3.5 hover:border-ink-400">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink-900">{u.displayName || u.email}</p>
                    <p className="mt-0.5 text-[11px] text-ink-500">
                      {u.email} · Applied {formatDate(u.createdAt)}
                    </p>
                  </div>
                  <StatusBadge status={u.status} />
                </Link>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink-700">Recent Submissions</h2>
          {recentSubmissions.length === 0 ? (
            <p className="mt-3 text-sm text-ink-500">No submissions yet.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {recentSubmissions.map((a) => (
                <Link key={a.id} href={`/admin/articles/${a.id}`} className="flex items-center justify-between gap-3 rounded-lg border border-ink-200 bg-white p-3.5 hover:border-ink-400">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink-900">{a.title}</p>
                    <p className="mt-0.5 text-[11px] text-ink-500">
                      By {a.authorName} · Submitted {formatDate(a.submittedAt)}
                    </p>
                  </div>
                  <StatusBadge status={a.status} />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
