import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getNotifications } from "@/lib/notifications";
import NotificationsList from "@/components/dashboard/NotificationsList";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Notifications", robots: { index: false, follow: false } };

export default async function NotificationsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const notifications = await getNotifications(session.userId);

  return (
    <div>
      <h1 className="font-serif text-2xl font-bold text-ink-900">Notifications</h1>
      <p className="mt-1 text-sm text-ink-600">
        Updates on your account and article status changes. We also send these to your registered email.
      </p>
      <NotificationsList initial={notifications} />
    </div>
  );
}
