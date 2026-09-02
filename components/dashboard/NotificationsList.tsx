"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Notification } from "@/lib/notifications";
import { useToast } from "@/components/ToastProvider";

const TYPE_LABELS: Record<string, string> = {
  account_approved: "Account",
  account_rejected: "Account",
  article_submitted: "Submission",
  article_under_review: "Review",
  changes_requested: "Changes requested",
  article_approved: "Approved",
  article_rejected: "Rejected",
  article_scored: "Scored",
  article_published: "Published",
  article_unpublished: "Unpublished",
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function NotificationsList({ initial }: { initial: Notification[] }) {
  const router = useRouter();
  const toast = useToast();
  const [notifications, setNotifications] = useState<Notification[]>(initial);
  const [markingAll, setMarkingAll] = useState(false);
  const unreadCount = notifications.filter((n) => !n.readAt).length;

  async function handleItemClick(n: Notification) {
    if (!n.readAt) {
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
      try {
        const res = await fetch(`/api/dashboard/notifications/${n.id}`, { method: "PATCH" });
        if (!res.ok) throw new Error();
      } catch {
        setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, readAt: null } : x)));
        toast.error("Couldn't mark notification as read.");
        return;
      }
    }
    if (n.link) router.push(n.link);
  }

  async function handleMarkAllRead() {
    const prevState = notifications;
    setMarkingAll(true);
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })));
    try {
      const res = await fetch("/api/dashboard/notifications", { method: "PATCH" });
      if (!res.ok) throw new Error();
    } catch {
      setNotifications(prevState);
      toast.error("Couldn't mark all as read. Try again.");
    } finally {
      setMarkingAll(false);
    }
  }

  if (notifications.length === 0) {
    return (
      <div className="mt-6 rounded-lg border border-dashed border-ink-200 bg-white p-8 text-center">
        <p className="text-sm text-ink-500">You don't have any notifications yet.</p>
        <p className="mt-1 text-xs text-ink-400">
          We'll notify you here (and by email) when your account or articles change status.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs font-semibold text-ink-500">
          {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
        </p>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            disabled={markingAll}
            className="text-xs font-semibold text-signal hover:underline disabled:opacity-50"
          >
            {markingAll ? "Marking..." : "Mark all read"}
          </button>
        )}
      </div>

      <div className="mt-3 space-y-2">
        {notifications.map((n) => (
          <button
            key={n.id}
            type="button"
            onClick={() => handleItemClick(n)}
            className={`block w-full rounded-lg border p-4 text-left transition-colors ${!n.readAt ? "border-signal/30 bg-signal-light/40 hover:border-signal/60" : "border-ink-200 bg-white hover:border-ink-400"
              }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-500">
                  {TYPE_LABELS[n.type] || n.type}
                </span>
                {!n.readAt && <span className="h-1.5 w-1.5 rounded-full bg-signal" />}
              </div>
              <p className="text-[11px] text-ink-400">{formatDateTime(n.createdAt)}</p>
            </div>
            <p className={`mt-1.5 text-sm font-semibold ${!n.readAt ? "text-ink-900" : "text-ink-700"}`}>{n.title}</p>
            {n.body && <p className="mt-1 text-xs leading-relaxed text-ink-600">{n.body}</p>}
          </button>
        ))}
      </div>
    </div>
  );
}
