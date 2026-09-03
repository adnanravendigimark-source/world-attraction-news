import Link from "next/link";
import type { Metadata } from "next";
import { getAllArticles, getDraftArticleCount, summarizePoints } from "@/lib/articles";
import { getUsers } from "@/lib/users";
import { getCities } from "@/lib/cities";
import { getCategories } from "@/lib/categories";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Desk Overview | World Attraction News Admin",
  robots: { index: false, follow: false },
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function StatCard({
  label,
  value,
  href,
  urgent,
  sub,
  icon,
}: {
  label: string;
  value: number | string;
  href?: string;
  urgent?: boolean;
  sub?: string;
  icon?: React.ReactNode;
}) {
  const content = (
    <div
      className={`rounded-xl border p-4 transition-all ${
        urgent
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
      <p className={`font-sans text-xl sm:text-2xl font-bold ${urgent ? "text-[#DC2626]" : "text-slate-900"}`}>
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-slate-500 font-medium">{sub}</p>}
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

export default async function AdminOverviewPage() {
  // getAllArticles() (no filter) never includes drafts (see its own
  // comment in lib/articles.ts), so drafts need a second read — but only a
  // COUNT, not full joined rows, since nothing here displays a draft list,
  // just its number. This also avoids running
  // publishDueScheduledArticles()'s UPDATE a second time in the same
  // request (getAllArticles() already ran it once) and avoids fetching
  // every draft's content_html just to read an array's .length.
  const [nonDraftArticles, draftCount, users, cities, categories] = await Promise.all([
    getAllArticles(),
    getDraftArticleCount(),
    getUsers(),
    getCities(),
    getCategories(),
  ]);

  const usersByStatus = {
    pending: users.filter((u) => u.status === "pending" && u.emailVerified).length,
    approved: users.filter((u) => u.status === "approved").length,
    rejected: users.filter((u) => u.status === "rejected").length,
    suspended: users.filter((u) => u.status === "suspended").length,
  };

  const articlesByStatus = {
    draft: draftCount,
    pending: nonDraftArticles.filter((a) => a.status === "pending").length,
    changes_requested: nonDraftArticles.filter((a) => a.status === "changes_requested").length,
    approved: nonDraftArticles.filter((a) => a.status === "approved").length,
    rejected: nonDraftArticles.filter((a) => a.status === "rejected").length,
    published: nonDraftArticles.filter((a) => a.status === "published").length,
  };

  // Drafts never carry a score (only submitted/reviewed articles do), so
  // leaving them out of summarizePoints()'s input changes nothing about the
  // totals — it just avoids fetching their full rows only to have every one
  // of them filtered straight back out again.
  const points = summarizePoints(nonDraftArticles);

  const awaitingReview = nonDraftArticles.filter((a) => a.status === "pending").slice(0, 6);
  const recentlyPublished = [...nonDraftArticles]
    .filter((a) => a.status === "published")
    .sort((a, b) => new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime())
    .slice(0, 5);
  const pendingUsers = users.filter((u) => u.status === "pending" && u.emailVerified).slice(0, 4);
  const totalArticles = nonDraftArticles.length + draftCount;

  return (
    <div className="space-y-5">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <span className="h-2 w-2 rounded-full bg-[#DC2626] animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#DC2626]">
              NEWSROOM COMMAND
            </span>
          </div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900">
            Editorial Desk Overview
          </h1>
          <p className="mt-0.5 text-xs text-slate-500 font-medium">
            Monitor article review queues, contributor approvals, and live published dispatches.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/articles?status=pending"
            className="inline-flex items-center gap-2 rounded-lg bg-[#DC2626] px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-2xs hover:bg-[#B91C1C] transition-colors"
          >
            <span>Review Queue</span>
            {articlesByStatus.pending > 0 && (
              <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-[#DC2626]">
                {articlesByStatus.pending}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* Primary 4 Metric Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Pending Review"
          value={articlesByStatus.pending}
          href="/admin/articles?status=pending"
          urgent={articlesByStatus.pending > 0}
          sub="Dispatches needing review"
          icon={
            <svg className="h-3.5 w-3.5 text-[#DC2626]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          label="Pending Writers"
          value={usersByStatus.pending}
          href="/admin/users?status=pending"
          urgent={usersByStatus.pending > 0}
          sub="Contributor applications"
          icon={
            <svg className="h-3.5 w-3.5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          }
        />
        <StatCard
          label="Live Articles"
          value={articlesByStatus.published}
          href="/admin/articles?status=published"
          sub={`${totalArticles} total articles`}
          icon={
            <svg className="h-3.5 w-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          label="Average Score"
          value={points.averageScore !== null ? `${points.averageScore}/10` : "—"}
          href="/admin/points"
          sub={`${points.totalPoints} quality points`}
          icon={
            <svg className="h-3.5 w-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          }
        />
      </div>

      {/* Secondary Quick Metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Destinations" value={cities.length} href="/admin/cities" />
        <StatCard label="Categories" value={categories.length} href="/admin/categories" />
        <StatCard label="Active Writers" value={usersByStatus.approved} href="/admin/users?status=approved" />
        <StatCard label="Drafts" value={articlesByStatus.draft} href="/admin/articles?status=draft" />
      </div>

      {/* Main 2-Column Split: Review Workbench & Recently Published */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Awaiting Review Queue */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Articles Awaiting Review
            </h2>
            <Link
              href="/admin/articles?status=pending"
              className="text-xs font-semibold text-[#DC2626] hover:underline"
            >
              View All ({articlesByStatus.pending}) →
            </Link>
          </div>

          {awaitingReview.length === 0 ? (
            <div className="py-8 text-center bg-slate-50 rounded-lg border border-dashed border-slate-200">
              <span className="text-emerald-600 font-bold text-sm block mb-1">✓ All Caught Up</span>
              <p className="text-xs text-slate-500">No submissions currently waiting in the review queue.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {awaitingReview.map((a) => (
                <Link
                  key={a.id}
                  href={`/admin/articles/${a.id}`}
                  className="group flex items-center justify-between gap-3 py-2.5 hover:bg-slate-50 transition-colors px-2 rounded-lg -mx-1"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs sm:text-sm font-semibold text-slate-900 group-hover:text-[#DC2626] transition-colors">
                      {a.title}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500 font-medium">
                      By {a.authorName} · {a.cityName} · {formatDate(a.submittedAt)}
                    </p>
                  </div>
                  <span className="rounded-md bg-[#DC2626] px-2.5 py-1 text-[11px] font-bold text-white shadow-2xs group-hover:bg-[#B91C1C] transition-colors shrink-0">
                    Review →
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recently Published */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Recently Published
            </h2>
            <Link
              href="/admin/articles?status=published"
              className="text-xs font-semibold text-slate-600 hover:text-[#DC2626]"
            >
              View All ({articlesByStatus.published}) →
            </Link>
          </div>

          {recentlyPublished.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-400">No published articles yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentlyPublished.map((a) => (
                <Link
                  key={a.id}
                  href={`/admin/articles/${a.id}`}
                  className="group flex items-center justify-between gap-3 py-2.5 hover:bg-slate-50 transition-colors px-2 rounded-lg -mx-1"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs sm:text-sm font-semibold text-slate-900 group-hover:text-[#DC2626] transition-colors">
                      {a.title}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500 font-medium">
                      By {a.authorName} · {a.cityName} · Published {formatDate(a.publishedAt)}
                    </p>
                  </div>
                  {a.score !== null && (
                    <span className="rounded bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[10px] font-mono font-bold text-amber-900 shrink-0">
                      ★ {a.score}/10
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Contributor Applications Card */}
      {pendingUsers.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50/50 p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between border-b border-amber-200 pb-3 mb-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-900">
                ACTION REQUIRED
              </p>
              <h2 className="text-sm font-bold text-slate-900">
                Pending Contributor Applications ({usersByStatus.pending})
              </h2>
            </div>
            <Link
              href="/admin/users?status=pending"
              className="text-xs font-bold text-amber-900 hover:underline"
            >
              Manage Applicants →
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {pendingUsers.map((u) => (
              <div key={u.id} className="rounded-lg border border-amber-200 bg-white p-3 shadow-2xs">
                <p className="font-bold text-xs text-slate-900 truncate">{u.displayName || u.email}</p>
                <p className="text-[11px] text-slate-500 truncate">{u.email}</p>
                <p className="mt-1 text-[10px] text-slate-400">Applied {formatDate(u.createdAt)}</p>
                <Link
                  href={`/admin/users/${u.id}`}
                  className="mt-2 inline-block text-xs font-bold text-[#DC2626] hover:underline"
                >
                  Review Application →
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
