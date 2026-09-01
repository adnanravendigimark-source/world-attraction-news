"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Notification } from "@/lib/notifications";
import { useToast } from "@/components/ToastProvider";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function NotificationBell() {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  async function load() {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/dashboard/notifications");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
      setLoaded(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  // Load the unread count once on mount (badge should be accurate even
  // before the dropdown is ever opened), then reload full list on open.
  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function handleOpen() {
    setOpen((v) => !v);
    if (!loaded) await load();
  }

  async function handleItemClick(n: Notification) {
    setOpen(false);
    if (!n.readAt) {
      setUnreadCount((c) => Math.max(0, c - 1));
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
      fetch(`/api/dashboard/notifications/${n.id}`, { method: "PATCH" }).catch(() => {});
    }
    if (n.link) router.push(n.link);
  }

  async function handleMarkAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })));
    setUnreadCount(0);
    try {
      const res = await fetch("/api/dashboard/notifications", { method: "PATCH" });
      if (!res.ok) throw new Error();
    } catch {
      toast.error("Couldn't mark all as read.");
      load();
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={handleOpen}
        className="relative rounded-md p-1.5 text-ink-500 hover:bg-ink-100 hover:text-ink-800"
        aria-label="Notifications"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 6.5H4.5C4.5 13.5 6 12 6 8Z" />
          <path d="M10 19a2 2 0 0 0 4 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-signal px-1 text-[9px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 max-w-[90vw] rounded-lg border border-ink-200 bg-white shadow-lift">
          <div className="flex items-center justify-between border-b border-ink-100 px-3 py-2.5">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-500">Notifications</p>
            {unreadCount > 0 && (
              <button type="button" onClick={handleMarkAllRead} className="text-[11px] font-semibold text-signal hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {loading && !loaded && <p className="px-3 py-6 text-center text-xs text-ink-400">Loading...</p>}
            {error && <p className="px-3 py-6 text-center text-xs text-signal">Couldn't load notifications.</p>}
            {!loading && !error && loaded && notifications.length === 0 && (
              <p className="px-3 py-6 text-center text-xs text-ink-400">You're all caught up.</p>
            )}
            {notifications.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => handleItemClick(n)}
                className={`block w-full border-b border-ink-50 px-3 py-2.5 text-left text-xs last:border-0 hover:bg-ink-50 ${
                  !n.readAt ? "bg-signal-light/40" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className={`font-semibold ${!n.readAt ? "text-ink-900" : "text-ink-600"}`}>{n.title}</p>
                  {!n.readAt && <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-signal" />}
                </div>
                {n.body && <p className="mt-0.5 line-clamp-2 text-ink-500">{n.body}</p>}
                <p className="mt-1 text-[10px] text-ink-400">{formatDate(n.createdAt)}</p>
              </button>
            ))}
          </div>
          <div className="border-t border-ink-100 px-3 py-2 text-center">
            <Link href="/dashboard/notifications" onClick={() => setOpen(false)} className="text-[11px] font-semibold text-signal hover:underline">
              View all
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
