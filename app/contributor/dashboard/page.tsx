import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getArticlesByAuthor, summarizePoints } from "@/lib/articles";
import { getNotifications } from "@/lib/notifications";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Dashboard | World Attraction News",
  robots: { index: false, follow: false },
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}

const NOTIFICATION_ICONS: Record<string, string> = {
  account_approved: "🎉",
  account_rejected: "🚫",
  article_submitted: "📤",
  article_under_review: "👀",
  changes_requested: "✏️",
  article_approved: "✅",
  article_rejected: "❌",
  article_scored: "⭐",
  article_published: "📰",
  article_unpublished: "📴",
};

// This page shows only what's actually true about the contributor's own
// account — every number here comes straight from the database, with no
// fabricated fallback content for a brand-new account with zero articles
// (that account should just see honest empty states, not a demo showing
// someone else's fake dispatches).
export default async function DashboardOverviewPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [articles, notifications] = await Promise.all([
    getArticlesByAuthor(session.userId),
    getNotifications(session.userId, 5),
  ]);
  const points = summarizePoints(articles);

  const totalCount = articles.length;
  const publishedCount = articles.filter((a) => a.status === "published").length;
  const inReviewCount = articles.filter((a) => a.status === "pending" || a.status === "under_review").length;
  const needsAttentionCount = articles.filter(
    (a) => a.status === "changes_requested" || a.status === "rejected"
  ).length;

  const recent = [...articles].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">Dashboard</h1>
        <p className="text-xs text-slate-500 font-medium mt-0.5">
          An overview of your articles, points, and recent activity.
        </p>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Articles</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-[#DC2626]">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-slate-900">{totalCount}</p>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Published</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-slate-900">{publishedCount}</p>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">In Review</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-500">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-slate-900">{inReviewCount}</p>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Points</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-500">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-slate-900">{points.totalPoints}</p>
        </div>
      </div>

      {needsAttentionCount > 0 && (
        <Link
          href="/contributor/articles"
          className="flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 transition-colors"
        >
          <span>
            {needsAttentionCount} article{needsAttentionCount === 1 ? "" : "s"} need{needsAttentionCount === 1 ? "s" : ""} your attention
            (changes requested or rejected).
          </span>
          <span>Review →</span>
        </Link>
      )}

      {/* Main 2-Column Split */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Left Column: Recent Articles */}
        <div className="lg:col-span-7 space-y-6">
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900">Recent Articles</h2>
              <Link href="/contributor/articles" className="text-xs font-semibold text-slate-500 hover:text-[#DC2626] transition-colors">
                View All →
              </Link>
            </div>

            {recent.length === 0 ? (
              <div className="py-10 text-center space-y-3">
                <p className="text-xs text-slate-400">You haven't written anything yet.</p>
                <Link
                  href="/contributor/articles/new"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#DC2626] px-4 py-2 text-xs font-bold text-white hover:bg-[#B91C1C] transition-colors"
                >
                  Write Your First Article →
                </Link>
              </div>
            ) : (
              <div className="space-y-3.5">
                {recent.map((art) => (
                  <Link
                    key={art.id}
                    href={art.status === "draft" ? `/contributor/articles/${art.id}/edit` : `/contributor/articles/${art.id}`}
                    className="flex items-center gap-3.5 group rounded-xl p-2 hover:bg-slate-50 transition-colors"
                  >
                    <div className="relative h-14 w-16 sm:w-20 rounded-xl overflow-hidden bg-slate-100 shrink-0 border border-slate-200">
                      {art.image && (
                        <Image src={art.image} alt={art.title} fill className="object-cover group-hover:scale-105 transition-transform" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 capitalize">
                        {art.status.replace(/_/g, " ")}
                      </span>
                      <h3 className="text-xs sm:text-sm font-bold text-slate-900 line-clamp-1 group-hover:text-[#DC2626] transition-colors">
                        {art.title || "Untitled Draft"}
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        {art.cityName} · {formatDate(art.updatedAt)}
                        {art.status === "published" ? ` · ${art.viewCount} views` : ""}
                        {art.score !== null ? ` · ${art.score}/10 points` : ""}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Points, Notifications, CTA */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900">Points &amp; Scores</h2>
              <Link href="/contributor/points" className="text-xs font-semibold text-slate-500 hover:text-[#DC2626] transition-colors">
                View Details →
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-xl bg-slate-50 py-3.5">
                <p className="text-2xl font-extrabold text-slate-900">{points.totalPoints}</p>
                <p className="text-[10px] font-medium text-slate-400 mt-0.5">Total Points</p>
              </div>
              <div className="rounded-xl bg-slate-50 py-3.5">
                <p className="text-2xl font-extrabold text-slate-900">
                  {points.averageScore !== null ? points.averageScore : "—"}
                </p>
                <p className="text-[10px] font-medium text-slate-400 mt-0.5">Avg. Score</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900">Latest Notifications</h2>
              <Link href="/contributor/notifications" className="text-xs font-semibold text-slate-500 hover:text-[#DC2626] transition-colors">
                View All →
              </Link>
            </div>

            {notifications.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-400">You're all caught up.</p>
            ) : (
              <div className="space-y-3">
                {notifications.map((n) => (
                  <Link
                    key={n.id}
                    href={n.link || "/contributor/notifications"}
                    className="flex items-start gap-3 text-xs group"
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-full shrink-0 text-xs bg-slate-50">
                      {NOTIFICATION_ICONS[n.type] || "🔔"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`leading-tight ${n.readAt ? "text-slate-600 font-medium" : "text-slate-900 font-semibold"} group-hover:text-[#DC2626] transition-colors`}>
                        {n.title}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{timeAgo(n.createdAt)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center text-xl shrink-0">
                ✍️
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-bold text-slate-900">Ready to write?</h3>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                  Share your next travel story with our readers.
                </p>
              </div>
            </div>
            <Link
              href="/contributor/articles/new"
              className="shrink-0 rounded-xl bg-[#DC2626] px-3.5 py-2 text-xs font-bold text-white shadow-2xs hover:bg-[#B91C1C] transition-all"
            >
              Write →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
