import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getNotifications } from "@/lib/notifications";
import NotificationsList from "@/components/dashboard/NotificationsList";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Notifications | World Attraction News",
  robots: { index: false, follow: false },
};

export default async function NotificationsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const notifications = await getNotifications(session.userId);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-50 text-[#DC2626] text-xl shadow-2xs">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Notifications
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Updates on article reviews, editorial feedback, and publishing status.
          </p>
        </div>
      </div>

      <NotificationsList initial={notifications} />
    </div>
  );
}
