import type { Metadata } from "next";
import { getCities } from "@/lib/cities";
import { getAllEvents } from "@/lib/events";
import { getPublishedArticlesForPicker } from "@/lib/articles";
import EventsManager from "@/components/admin/EventsManager";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Calendar Events | World Attraction News Admin", robots: { index: false, follow: false } };

export default async function AdminEventsPage() {
  const [cities, events, articles] = await Promise.all([getCities(), getAllEvents(), getPublishedArticlesForPicker()]);

  return (
    <div className="space-y-5">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Calendar Events</h1>
        <p className="mt-0.5 text-xs sm:text-sm text-slate-500 font-medium">
          Festivals, ride openings, and seasonal celebrations. Everything here drives the public /calendar page
          directly — nothing shows there until it&apos;s created here.
        </p>
      </div>

      <EventsManager initialEvents={events} cities={cities} articles={articles} />
    </div>
  );
}
