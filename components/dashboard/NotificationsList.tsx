"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Notification } from "@/lib/notifications";
import { useToast } from "@/components/ToastProvider";

function formatDateTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffHours < 1) return "Just now";
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;

  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function NotificationIcon({ type }: { type: string }) {
  if (type.includes("published") || type.includes("approved")) {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 shrink-0">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
        </svg>
      </div>
    );
  }
  if (type.includes("scored")) {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 shrink-0">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      </div>
    );
  }
  if (type.includes("changes") || type.includes("rejected")) {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-[#DC2626] shrink-0">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      </div>
    );
  }
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shrink-0">
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </div>
  );
}

export default function NotificationsList({ initial }: { initial: Notification[] }) {
  const router = useRouter();
  const toast = useToast();
  const [notifications, setNotifications] = useState<Notification[]>(initial);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [markingAll, setMarkingAll] = useState(false);

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  const filtered = useMemo(() => {
    if (filter === "unread") return notifications.filter((n) => !n.readAt);
    return notifications;
  }, [notifications, filter]);

  async function handleItemClick(n: Notification) {
    if (!n.readAt) {
      setNotifications((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x))
      );
      try {
        await fetch(`/api/dashboard/notifications/${n.id}`, { method: "PATCH" });
      } catch {}
    }
    if (n.link) router.push(n.link);
  }

  async function handleMarkAllRead() {
    setMarkingAll(true);
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })));
    try {
      await fetch("/api/dashboard/notifications", { method: "PATCH" });
      toast.success("All notifications marked as read.");
    } catch {
      toast.error("Couldn't mark all as read.");
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Filter Tabs & Mark All Actions */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`rounded-full px-3.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
              filter === "all"
                ? "bg-[#DC2626] text-white font-bold"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            All ({notifications.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("unread")}
            className={`rounded-full px-3.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
              filter === "unread"
                ? "bg-[#DC2626] text-white font-bold"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            Unread ({unreadCount})
          </button>
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            disabled={markingAll}
            onClick={handleMarkAllRead}
            className="text-xs font-bold text-[#DC2626] hover:underline cursor-pointer"
          >
            Mark all as read
          </button>
        )}
      </div>

      {/* Notifications List */}
      <div className="rounded-2xl border border-slate-200/90 bg-white shadow-2xs divide-y divide-slate-100 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">
            No notifications to display.
          </div>
        ) : (
          filtered.map((n) => {
            const isUnread = !n.readAt;

            return (
              <div
                key={n.id}
                onClick={() => handleItemClick(n)}
                className={`flex items-start gap-4 p-4 transition-colors cursor-pointer hover:bg-slate-50/80 ${
                  isUnread ? "bg-rose-50/20" : ""
                }`}
              >
                <NotificationIcon type={n.type} />

                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-xs sm:text-sm text-slate-900 line-clamp-1">
                      {n.title}
                    </p>
                    <span className="text-[11px] font-mono text-slate-400 shrink-0">
                      {formatDateTime(n.createdAt)}
                    </span>
                  </div>
                  {n.body && (
                    <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                      {n.body}
                    </p>
                  )}
                </div>

                {isUnread && (
                  <span className="h-2 w-2 rounded-full bg-[#DC2626] shrink-0 mt-2" />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
