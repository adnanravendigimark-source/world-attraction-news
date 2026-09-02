import type { Metadata } from "next";
import { getCities } from "@/lib/cities";
import { getAllEvents } from "@/lib/events";
import EventsManager from "@/components/admin/EventsManager";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Calendar Events", robots: { index: false, follow: false } };

export default async function AdminEventsPage() {
  const [cities, events] = await Promise.all([getCities(), getAllEvents()]);

  return (
    <div>
      <h1 className="font-serif text-2xl font-bold text-ink-900">Calendar Events</h1>
      <p className="mt-1 text-sm text-ink-600">
        Festivals, ride openings, and seasonal celebrations. Everything here drives the public /calendar page directly
        — nothing shows there until it&apos;s created here.
      </p>
      <div className="mt-6">
        <EventsManager initialEvents={events} cities={cities} />
      </div>
    </div>
  );
}
