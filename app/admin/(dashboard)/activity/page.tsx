import type { Metadata } from "next";
import { getActivityLog } from "@/lib/activity";
import ActivityLog from "@/components/admin/ActivityLog";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin Activity Log", robots: { index: false, follow: false } };

export default async function AdminActivityPage() {
  const entries = await getActivityLog(200);

  return (
    <div>
      <h1 className="font-serif text-2xl font-bold text-ink-900">Activity Log</h1>
      <p className="mt-1 text-sm text-ink-600">
        Every meaningful admin action, most recent first — approvals, rejections, suspensions, scores, publishing,
        and content changes. Showing the last {entries.length} recorded {entries.length === 1 ? "entry" : "entries"}.
      </p>
      <div className="mt-6">
        <ActivityLog entries={entries} />
      </div>
    </div>
  );
}
