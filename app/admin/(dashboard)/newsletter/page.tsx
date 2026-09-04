import type { Metadata } from "next";
import { Suspense } from "react";
import { getSubscribers } from "@/lib/newsletter";
import SubscribersManager from "@/components/admin/SubscribersManager";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Newsletter Subscribers | World Attraction News Admin",
  robots: { index: false, follow: false },
};

export default async function AdminNewsletterPage() {
  const subscribers = await getSubscribers();

  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-400">Loading subscribers...</div>}>
      <SubscribersManager initialSubscribers={subscribers} />
    </Suspense>
  );
}
