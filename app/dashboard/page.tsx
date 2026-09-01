import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getArticlesByAuthor, summarizePoints } from "@/lib/articles";
import StatusBadge from "@/components/StatusBadge";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dashboard Overview", robots: { index: false, follow: false } };

function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg border border-ink-200 bg-white p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">{label}</p>
      <p className="mt-1.5 font-serif text-2xl font-bold text-ink-900">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-ink-500">{sub}</p>}
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
  const rejectedCount = articles.filter((a) => a.status === "rejected").length;
  const publishedCount = articles.filter((a) => a.status === "published").length;
  const approvedOrPublished = articles.filter((a) => a.status === "approved" || a.status === "published").length;

  const recent = [...articles]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 6);

  const feedbackItems = articles
    .filter((a) => a.adminFeedback && (a.status === "rejected" || a.status === "approved" || a.status === "published"))
    .sort((a, b) => new Date(b.reviewedAt || 0).getTime() - new Date(a.reviewedAt || 0).getTime())
    .slice(0, 3);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold text-ink-900">Welcome back, {session.displayName || "there"}</h1>
          <p className="mt-1 text-sm text-ink-600">You can submit articles for any city on the site.</p>
        </div>
        <Link
          href="/dashboard/articles/new"
          className="inline-flex items-center justify-center rounded-md bg-signal px-4 py-2 text-sm font-semibold text-white hover:bg-signal-dark"
        >
          + Write New Article
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Submitted" value={articles.length - draftCount} sub={`${draftCount} draft(s) not yet submitted`} />
        <StatCard label="Approved / Published" value={approvedOrPublished} sub={`${publishedCount} live on the site`} />
        <StatCard label="Total Points Earned" value={points.totalPoints} sub={points.averageScore !== null ? `Avg score ${points.averageScore}/10` : "No scores yet"} />
        <StatCard label="Pending Review" value={pendingCount} sub={rejectedCount ? `${rejectedCount} need revision` : "All caught up"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide text-ink-700">Recent Activity</h2>
            <Link href="/dashboard/articles" className="text-xs font-semibold text-signal hover:underline">
              View all →
            </Link>
          </div>
          {recent.length === 0 ? (
            <div className="mt-3 rounded-lg border border-dashed border-ink-300 bg-white p-8 text-center">
              <p className="text-sm text-ink-500">Nothing here yet.</p>
              <Link href="/dashboard/articles/new" className="mt-2 inline-block text-sm font-semibold text-signal hover:underline">
                Write your first article →
              </Link>
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              {recent.map((a) => (
                <Link
                  key={a.id}
                  href={a.status === "draft" ? `/dashboard/articles/${a.id}/edit` : `/dashboard/articles/${a.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-ink-200 bg-white p-3.5 hover:border-ink-400"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink-900">{a.title}</p>
                    <p className="mt-0.5 text-[11px] text-ink-500">
                      {a.cityName} · Updated {formatDate(a.updatedAt)}
                    </p>
                  </div>
                  <StatusBadge status={a.status} />
                </Link>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink-700">Notifications</h2>
          {feedbackItems.length === 0 ? (
            <p className="mt-3 text-xs text-ink-500">No editor feedback yet.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {feedbackItems.map((a) => (
                <div key={a.id} className="rounded-lg border border-ink-200 bg-white p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs font-semibold text-ink-900">{a.title}</p>
                    <StatusBadge status={a.status} />
                  </div>
                  {a.score !== null && <p className="mt-1 text-[11px] text-ink-500">Score: {a.score}/10</p>}
                  <p className="mt-1.5 text-[11px] leading-relaxed text-ink-600">{a.adminFeedback}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
