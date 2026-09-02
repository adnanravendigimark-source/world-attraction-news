import Link from "next/link";
import type { Metadata } from "next";
import { getAllArticles, summarizePoints } from "@/lib/articles";
import { getUsers } from "@/lib/users";
import { getCities } from "@/lib/cities";
import { getCategories } from "@/lib/categories";
import StatusBadge from "@/components/StatusBadge";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Editorial Command Center | Admin", robots: { index: false, follow: false } };

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
}: {
  label: string;
  value: number | string;
  href?: string;
  urgent?: boolean;
  sub?: string;
}) {
  const content = (
    <div
      className={`rounded-2xl border p-5 shadow-card transition-all ${
        urgent
          ? "border-signal/40 bg-signal-light/60 hover:shadow-lift"
          : "border-ink-200/80 bg-white hover:border-ink-400 hover:shadow-lift"
      }`}
    >
      <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-ink-500">{label}</p>
      <p className={`mt-2 font-serif text-3xl font-black ${urgent ? "text-signal" : "text-ink-950"}`}>
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-ink-500">{sub}</p>}
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
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
    changes_requested: nonDraftArticles.filter((a) => a.status === "changes_requested").length,
    approved: nonDraftArticles.filter((a) => a.status === "approved").length,
    rejected: nonDraftArticles.filter((a) => a.status === "rejected").length,
    published: nonDraftArticles.filter((a) => a.status === "published").length,
  };

  const points = summarizePoints(articles);

  const awaitingReview = nonDraftArticles.filter((a) => a.status === "pending").slice(0, 6);
  const recentlyPublished = [...nonDraftArticles]
    .filter((a) => a.status === "published")
    .sort((a, b) => new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime())
    .slice(0, 5);
  const pendingUsers = users.filter((u) => u.status === "pending").slice(0, 5);

  return (
    <div className="space-y-8">
      {/* Header & Urgent Action Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-ink-200/80 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="h-2 w-2 rounded-full bg-signal animate-pulse" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-signal">
              Editorial Command
            </span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-black text-ink-950">
            Newsroom Control Center
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-ink-600">
            Live database overview of submissions, correspondent approvals, and active bureaus.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/admin/articles?status=pending"
            className="inline-flex items-center gap-2 rounded-xl bg-signal px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-card hover:bg-signal-dark hover:shadow-lift transition-all"
          >
            <span>Review Queue</span>
            {articlesByStatus.pending > 0 && (
              <span className="rounded-full bg-white px-2 py-0.5 font-mono text-[10px] font-bold text-signal">
                {articlesByStatus.pending}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* Primary KPI Action Grid */}
      <div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard
            label="Pending Review"
            value={articlesByStatus.pending}
            href="/admin/articles?status=pending"
            urgent={articlesByStatus.pending > 0}
            sub="Dispatches needing evaluation"
          />
          <StatCard
            label="Pending Writers"
            value={usersByStatus.pending}
            href="/admin/users?status=pending"
            urgent={usersByStatus.pending > 0}
            sub="Contributor applications"
          />
          <StatCard
            label="Live Dispatches"
            value={articlesByStatus.published}
            href="/admin/articles?status=published"
            sub={`${articles.length} total on record`}
          />
          <StatCard
            label="Quality Score Avg"
            value={points.averageScore !== null ? `${points.averageScore}/10` : "—"}
            href="/admin/points"
            sub={`${points.totalPoints} points awarded`}
          />
        </div>
      </div>

      {/* Secondary Taxonomy & Operations Metrics */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Destination Bureaus" value={cities.length} href="/admin/cities" />
        <StatCard label="Coverage Beats" value={categories.length} href="/admin/categories" />
        <StatCard label="Approved Writers" value={usersByStatus.approved} href="/admin/users?status=approved" />
        <StatCard label="Drafts in Progress" value={articlesByStatus.draft} href="/admin/articles?status=draft" />
      </div>

      {/* Split Review Workbench Quick Lists */}
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Awaiting Review */}
        <div className="rounded-2xl border border-ink-200/80 bg-white p-6 shadow-card">
          <div className="flex items-center justify-between border-b border-ink-100 pb-4">
            <div>
              <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-signal">Priority Queue</p>
              <h2 className="font-serif text-lg font-black text-ink-900">Articles Awaiting Review</h2>
            </div>
            <Link href="/admin/articles?status=pending" className="text-xs font-bold text-signal hover:underline">
              View All ({articlesByStatus.pending}) →
            </Link>
          </div>

          {awaitingReview.length === 0 ? (
            <div className="py-12 text-center">
              <span className="text-2xl mb-2 block">✓</span>
              <p className="font-serif text-sm font-bold text-ink-700">Review queue is all caught up!</p>
              <p className="mt-1 text-xs text-ink-400">New dispatches from contributors will appear here.</p>
            </div>
          ) : (
            <div className="mt-4 divide-y divide-ink-100">
              {awaitingReview.map((a) => (
                <Link
                  key={a.id}
                  href={`/admin/articles/${a.id}`}
                  className="group flex items-center justify-between gap-4 py-3.5 hover:bg-paper-50 px-2 rounded-lg transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-serif text-sm font-bold text-ink-900 group-hover:text-signal transition-colors">
                      {a.title}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] text-ink-400">
                      By {a.authorName} · {a.cityName} · Submitted {formatDate(a.submittedAt)}
                    </p>
                  </div>
                  <span className="rounded-lg bg-signal px-3 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-subtle group-hover:bg-signal-dark transition-all">
                    Review →
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recently Published */}
        <div className="rounded-2xl border border-ink-200/80 bg-white p-6 shadow-card">
          <div className="flex items-center justify-between border-b border-ink-100 pb-4">
            <div>
              <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-emerald-700">Live Wire</p>
              <h2 className="font-serif text-lg font-black text-ink-900">Recently Published</h2>
            </div>
            <Link href="/admin/articles?status=published" className="text-xs font-bold text-ink-700 hover:text-signal">
              View All ({articlesByStatus.published}) →
            </Link>
          </div>

          {recentlyPublished.length === 0 ? (
            <p className="py-12 text-center text-xs text-ink-400">No published articles yet.</p>
          ) : (
            <div className="mt-4 divide-y divide-ink-100">
              {recentlyPublished.map((a) => (
                <Link
                  key={a.id}
                  href={`/admin/articles/${a.id}`}
                  className="group flex items-center justify-between gap-4 py-3.5 hover:bg-paper-50 px-2 rounded-lg transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-serif text-sm font-bold text-ink-900 group-hover:text-signal transition-colors">
                      {a.title}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] text-ink-400">
                      By {a.authorName} · {a.cityName} · Published {formatDate(a.publishedAt)}
                    </p>
                  </div>
                  {a.score !== null && (
                    <span className="rounded bg-amber-100 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-900">
                      ★ {a.score}/10
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Contributor Applications Strip */}
      {pendingUsers.length > 0 && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50/70 p-6 shadow-card">
          <div className="flex items-center justify-between border-b border-amber-200/80 pb-4">
            <div>
              <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-amber-900">
                Action Required
              </p>
              <h2 className="font-serif text-lg font-black text-ink-950">
                Pending Contributor Applications ({usersByStatus.pending})
              </h2>
            </div>
            <Link href="/admin/users?status=pending" className="text-xs font-bold text-amber-900 hover:underline">
              Manage Applicants →
            </Link>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {pendingUsers.map((u) => (
              <div key={u.id} className="rounded-xl border border-amber-200 bg-white p-4 shadow-subtle">
                <p className="font-bold text-sm text-ink-900">{u.displayName || u.email}</p>
                <p className="text-xs text-ink-500 truncate">{u.email}</p>
                <p className="mt-2 text-[10px] font-mono text-ink-400">Applied {formatDate(u.createdAt)}</p>
                <Link
                  href={`/admin/users/${u.id}`}
                  className="mt-3 inline-block text-xs font-bold text-signal hover:underline"
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
