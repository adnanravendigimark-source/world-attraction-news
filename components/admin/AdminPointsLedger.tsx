"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

interface ScoredArticle {
  id: string;
  title: string;
  authorName: string;
  authorEmail: string;
  cityName: string;
  categoryName?: string | null;
  score: number | null;
  reviewedAt: string | null;
  adminFeedback: string;
}

interface AuthorLeaderboard {
  id: string;
  name: string;
  email: string;
  scoredArticleCount: number;
  totalPoints: number;
  averageScore: number | null;
}

const AVATAR_COLORS = [
  "bg-slate-900 text-white",
  "bg-blue-600 text-white",
  "bg-emerald-600 text-white",
  "bg-amber-600 text-white",
  "bg-purple-600 text-white",
  "bg-teal-600 text-white",
  "bg-rose-600 text-white",
];

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Every number here comes straight from `scored`/`leaderboard` as passed
// down from the server (app/admin/(dashboard)/points/page.tsx, built from
// getAllArticles() + summarizePoints()) — no fallback/demo data. An empty
// database honestly shows zeros and empty states, not a fabricated
// "sample" leaderboard.
export default function AdminPointsLedger({
  initialScored,
  initialLeaderboard,
}: {
  initialScored: ScoredArticle[];
  initialLeaderboard: AuthorLeaderboard[];
}) {
  const [tab, setTab] = useState<"leaderboard" | "ledger">("leaderboard");
  const [query, setQuery] = useState("");

  const totalPointsAwarded = initialLeaderboard.reduce((sum, u) => sum + u.totalPoints, 0);
  const scoresForAverage = initialLeaderboard.filter((u) => u.averageScore !== null);
  const overallAverageScore =
    scoresForAverage.length > 0
      ? (scoresForAverage.reduce((sum, u) => sum + (u.averageScore || 0), 0) / scoresForAverage.length).toFixed(1)
      : null;
  const topScore = initialScored.reduce((max, a) => (a.score !== null && a.score > max ? a.score : max), 0);

  const filteredLeaderboard = useMemo(() => {
    if (!query.trim()) return initialLeaderboard;
    const q = query.toLowerCase();
    return initialLeaderboard.filter(
      (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  }, [initialLeaderboard, query]);

  const filteredScored = useMemo(() => {
    if (!query.trim()) return initialScored;
    const q = query.toLowerCase();
    return initialScored.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.authorName.toLowerCase().includes(q) ||
        a.authorEmail.toLowerCase().includes(q)
    );
  }, [initialScored, query]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Points Ledger &amp; Quality Scoring
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Points awarded, contributor leaderboard, and every scored article — all live from the database.
          </p>
        </div>

        <div className="relative min-w-[240px] sm:min-w-[280px]">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search contributor or article..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-3.5 pr-8 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#DC2626] focus:outline-none transition-all shadow-2xs"
          />
          <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
        </div>
      </div>

      {/* KPI Cards — real numbers only */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Points Awarded</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </div>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-extrabold text-slate-900">{totalPointsAwarded}</p>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">Across {initialScored.length} scored article{initialScored.length === 1 ? "" : "s"}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Editorial Average</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              {overallAverageScore !== null ? `${overallAverageScore} / 10` : "—"}
            </p>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">Across {initialScored.length} scored article{initialScored.length === 1 ? "" : "s"}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Scored Writers</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-extrabold text-slate-900">{initialLeaderboard.length}</p>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">With at least one scored article</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Top Score</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 text-[#DC2626]">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </div>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-extrabold text-[#DC2626]">
              {initialScored.length > 0 ? `${topScore} / 10` : "—"}
            </p>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">Highest score given so far</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-6 border-b border-slate-200 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setTab("leaderboard")}
          className={`pb-3 transition-colors relative cursor-pointer ${
            tab === "leaderboard" ? "text-[#DC2626] font-bold" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <span>Contributor Leaderboard ({filteredLeaderboard.length})</span>
          {tab === "leaderboard" && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#DC2626] rounded-full" />}
        </button>

        <button
          type="button"
          onClick={() => setTab("ledger")}
          className={`pb-3 transition-colors relative cursor-pointer ${
            tab === "ledger" ? "text-[#DC2626] font-bold" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <span>Score Audit Ledger ({filteredScored.length})</span>
          {tab === "ledger" && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#DC2626] rounded-full" />}
        </button>
      </div>

      {/* Leaderboard */}
      {tab === "leaderboard" &&
        (filteredLeaderboard.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-400 text-xs">
            {initialLeaderboard.length === 0
              ? "No articles have been scored yet — points appear here once an admin scores a review."
              : "No contributors match your search."}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50/75 border-b border-slate-200/80 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="py-3.5 px-5">Rank</th>
                    <th className="py-3.5 px-4 min-w-[240px]">Contributor</th>
                    <th className="py-3.5 px-4">Articles Scored</th>
                    <th className="py-3.5 px-4">Total Points</th>
                    <th className="py-3.5 px-4">Average Score</th>
                    <th className="py-3.5 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLeaderboard.map((u, idx) => {
                    const initials = u.name?.slice(0, 1).toUpperCase() || "W";
                    const colorClass = AVATAR_COLORS[idx % AVATAR_COLORS.length];
                    const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`;

                    return (
                      <tr key={u.email} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-5 font-bold text-slate-800 text-sm">{medal}</td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className={`flex h-8 w-8 items-center justify-center rounded-full font-bold text-xs shrink-0 ${colorClass}`}>
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 text-xs sm:text-sm line-clamp-1">{u.name}</p>
                              <p className="text-[11px] text-slate-400 truncate">{u.email}</p>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 font-semibold text-slate-700">{u.scoredArticleCount}</td>

                        <td className="py-3.5 px-4 font-mono font-bold">
                          <span className="rounded-md bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs text-amber-800">
                            {u.totalPoints} pts
                          </span>
                        </td>

                        <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                          {u.averageScore !== null ? `${u.averageScore} / 10` : "—"}
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          {u.id ? (
                            <Link
                              href={`/admin/users/${u.id}`}
                              className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                            >
                              View Profile
                            </Link>
                          ) : (
                            <span className="text-[11px] text-slate-300">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}

      {/* Score Audit Ledger */}
      {tab === "ledger" &&
        (filteredScored.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-400 text-xs">
            {initialScored.length === 0
              ? "No articles have been scored yet."
              : "No scored articles match your search."}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50/75 border-b border-slate-200/80 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="py-3.5 px-5 min-w-[280px]">Article &amp; Destination</th>
                    <th className="py-3.5 px-4 min-w-[160px]">Author</th>
                    <th className="py-3.5 px-4">Score</th>
                    <th className="py-3.5 px-4 min-w-[110px]">Reviewed Date</th>
                    <th className="py-3.5 px-4 min-w-[220px]">Admin Feedback</th>
                    <th className="py-3.5 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredScored.map((art) => (
                    <tr key={art.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-5">
                        <Link
                          href={`/admin/articles/${art.id}`}
                          className="font-bold text-slate-900 text-xs sm:text-sm hover:text-[#DC2626] transition-colors line-clamp-1 block"
                        >
                          {art.title}
                        </Link>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          <span className="text-[#DC2626] font-semibold">{art.cityName}</span> · {art.categoryName || "Attraction News"}
                        </p>
                      </td>

                      <td className="py-3.5 px-4">
                        <p className="font-bold text-slate-800 text-xs">{art.authorName}</p>
                        <p className="text-[11px] text-slate-400 truncate">{art.authorEmail}</p>
                      </td>

                      <td className="py-3.5 px-4 font-mono font-bold">
                        <span className="rounded-md bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs text-amber-800">
                          {art.score}/10 ★
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-slate-500 text-[11px]">{formatDate(art.reviewedAt)}</td>

                      <td className="py-3.5 px-4 text-xs text-slate-600">
                        {art.adminFeedback ? (
                          <p className="italic line-clamp-2">"{art.adminFeedback}"</p>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <Link
                          href={`/admin/articles/${art.id}`}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          Edit Score
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
    </div>
  );
}
