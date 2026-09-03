"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ActivityEntry } from "@/lib/activity";

const ACTION_LABELS: Record<string, string> = {
  user_approved: "Approved user",
  user_rejected: "Rejected user",
  user_suspended: "Suspended user",
  user_set_pending: "Reset user to pending",
  user_status_changed: "Changed user status",
  user_promoted_admin: "Promoted user to admin",
  user_demoted_contributor: "Demoted admin to contributor",
  user_deleted: "Deleted user",
  article_approved: "Approved article",
  article_rejected: "Rejected article",
  article_scored: "Scored article",
  article_published: "Published article",
  article_unpublished: "Unpublished article",
  article_edited: "Edited article",
  article_deleted: "Deleted article",
  city_created: "Created city",
  city_edited: "Edited city",
  city_deleted: "Deleted city",
  category_created: "Created category",
  category_edited: "Edited category",
  category_deleted: "Deleted category",
  settings_updated: "Updated site settings",
  admin_password_changed: "Changed admin password",
};

function actionLabel(action: string) {
  return ACTION_LABELS[action] || action.replace(/_/g, " ");
}

function targetHref(entry: ActivityEntry): string | null {
  switch (entry.targetType) {
    case "user":
      return `/admin/users/${entry.targetId}`;
    case "article":
      return `/admin/articles/${entry.targetId}`;
    default:
      return null;
  }
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ActivityLog({ entries }: { entries: ActivityEntry[] }) {
  const [query, setQuery] = useState("");
  const [targetType, setTargetType] = useState("all");
  const [adminEmail, setAdminEmail] = useState("all");
  const [dateFrom, setDateFrom] = useState("");

  const admins = useMemo(() => Array.from(new Set(entries.map((e) => e.adminEmail))).sort(), [entries]);
  const targetTypes = useMemo(() => Array.from(new Set(entries.map((e) => e.targetType))).sort(), [entries]);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (targetType !== "all" && e.targetType !== targetType) return false;
      if (adminEmail !== "all" && e.adminEmail !== adminEmail) return false;
      if (dateFrom && new Date(e.createdAt) < new Date(dateFrom)) return false;
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        const haystack = `${actionLabel(e.action)} ${e.targetLabel} ${e.adminEmail}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [entries, targetType, adminEmail, dateFrom, query]);

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search action, target, or admin..."
          className="w-full max-w-xs rounded-md border border-ink-300 px-3 py-1.5 text-xs focus:border-signal focus:outline-none"
        />
        <select
          value={targetType}
          onChange={(e) => setTargetType(e.target.value)}
          className="rounded-md border border-ink-300 bg-white px-2.5 py-1.5 text-xs"
        >
          <option value="all">All target types</option>
          {targetTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          value={adminEmail}
          onChange={(e) => setAdminEmail(e.target.value)}
          className="rounded-md border border-ink-300 bg-white px-2.5 py-1.5 text-xs"
        >
          <option value="all">All admins</option>
          {admins.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="rounded-md border border-ink-300 px-2.5 py-1.5 text-xs"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="mt-6 text-sm text-ink-500">{entries.length === 0 ? "No admin activity logged yet." : "No activity matches your filters."}</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-ink-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-ink-200 bg-ink-50 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-4 py-2.5">Action</th>
                <th className="px-4 py-2.5">Admin</th>
                <th className="px-4 py-2.5">Target</th>
                <th className="px-4 py-2.5">Date &amp; Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {filtered.map((e) => {
                const href = targetHref(e);
                return (
                  <tr key={e.id}>
                    <td className="px-4 py-2.5 font-semibold text-ink-900">{actionLabel(e.action)}</td>
                    <td className="px-4 py-2.5 text-ink-600">{e.adminEmail}</td>
                    <td className="px-4 py-2.5 text-ink-700">
                      {href ? (
                        <Link href={href} className="text-signal hover:underline">
                          {e.targetLabel || e.targetType}
                        </Link>
                      ) : (
                        e.targetLabel || e.targetType
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-ink-500">{formatDateTime(e.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
