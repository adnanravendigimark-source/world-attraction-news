import type { Metadata } from "next";
import { getAllArticles, summarizePoints } from "@/lib/articles";
import AdminPointsLedger from "@/components/admin/AdminPointsLedger";
import AccessDenied from "@/components/admin/AccessDenied";
import { getSession } from "@/lib/session";
import { getEffectivePermissions, hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Points Ledger & Scoring | World Attraction News Admin",
  robots: { index: false, follow: false },
};

export default async function AdminPointsPage() {
  const session = await getSession();
  const effective = await getEffectivePermissions(session);
  if (!hasPermission(effective, "points", "read")) {
    return <AccessDenied pageLabel="Points Ledger" />;
  }

  const articles = await getAllArticles();
  const scored = articles
    .filter((a) => a.score !== null && a.status !== "pending" && a.status !== "rejected")
    .sort((a, b) => new Date(b.reviewedAt || 0).getTime() - new Date(a.reviewedAt || 0).getTime());

  const byAuthor = new Map<string, { id: string; name: string; email: string; articles: typeof scored }>();
  for (const a of scored) {
    if (!byAuthor.has(a.authorEmail)) {
      byAuthor.set(a.authorEmail, { id: a.authorId, name: a.authorName, email: a.authorEmail, articles: [] });
    }
    byAuthor.get(a.authorEmail)!.articles.push(a);
  }
  const leaderboard = Array.from(byAuthor.values())
    .map((u) => {
      const summary = summarizePoints(u.articles);
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        scoredArticleCount: summary.scoredArticleCount,
        totalPoints: summary.totalPoints,
        averageScore: summary.averageScore,
      };
    })
    .sort((a, b) => b.totalPoints - a.totalPoints);

  return (
    <AdminPointsLedger
      initialScored={scored.map((a) => ({
        id: a.id,
        title: a.title,
        authorName: a.authorName,
        authorEmail: a.authorEmail,
        cityName: a.cityName,
        categoryName: a.categoryName,
        score: a.score,
        reviewedAt: a.reviewedAt,
        adminFeedback: a.adminFeedback,
      }))}
      initialLeaderboard={leaderboard}
    />
  );
}
