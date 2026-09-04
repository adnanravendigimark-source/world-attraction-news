import type { Metadata } from "next";
import CalendarClient from "./CalendarClient";
import { SITE_NAME } from "@/lib/site";
import { buildMetadata, breadcrumbJsonLd } from "@/lib/seo";
import { getEventsInRange, getUpcomingEvents, getPastEvents, type EventType } from "@/lib/events";
import { getCities } from "@/lib/cities";

// Stays force-dynamic (not ISR): the month grid, filters, and "today"
// marker all come from real-time `new Date()` and request searchParams —
// caching a render would freeze "today" at whatever moment it was
// generated and could serve one visitor's year/month/filter combination to
// another.
export const dynamic = "force-dynamic";

export const metadata: Metadata = buildMetadata({
  title: `Calendar — Attraction Events, Festivals & Openings | ${SITE_NAME}`,
  description: "Your comprehensive global calendar of theme park events, festivals, new ride openings, and landmark celebrations worldwide.",
  path: "/calendar",
});

const VALID_TYPES: EventType[] = ["festival", "opening", "exhibition", "special", "celebration"];

interface CalendarSearchParams {
  year?: string;
  month?: string;
  view?: string;
  tab?: string;
  type?: string;
  city?: string;
  q?: string;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export default async function CalendarPage({ searchParams }: { searchParams: CalendarSearchParams }) {
  // The real current date drives every default here — no hardcoded month.
  const now = new Date();
  const realYear = now.getFullYear();
  const realMonth = now.getMonth() + 1;
  const todayISO = `${realYear}-${pad(realMonth)}-${pad(now.getDate())}`;

  let year = Number(searchParams?.year) || realYear;
  let month = Number(searchParams?.month) || realMonth;
  // Normalize out-of-range month navigation (e.g. Jan - 1 -> prior Dec).
  if (month < 1 || month > 12) {
    const normalized = new Date(year, month - 1, 1);
    year = normalized.getFullYear();
    month = normalized.getMonth() + 1;
  }

  const view = searchParams?.view === "list" ? "list" : "month";
  const tab = searchParams?.tab === "past" ? "past" : "upcoming";

  const filters = {
    citySlug: searchParams?.city || undefined,
    eventType: VALID_TYPES.includes(searchParams?.type as EventType) ? (searchParams?.type as EventType) : undefined,
    query: searchParams?.q || undefined,
  };

  const monthStart = `${year}-${pad(month)}-01`;
  const daysInMonth = new Date(year, month, 0).getDate();
  const monthEnd = `${year}-${pad(month)}-${pad(daysInMonth)}`;

  const [monthEvents, listEvents, cities] = await Promise.all([
    getEventsInRange(monthStart, monthEnd, filters),
    view === "list" ? (tab === "past" ? getPastEvents(100, filters) : getUpcomingEvents(100, filters)) : Promise.resolve([]),
    getCities(),
  ]);

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const breadcrumbs = [
    { name: "Home", path: "/" },
    { name: "Calendar", path: "/calendar" },
  ];

  return (
    <>
      <CalendarClient
        monthEvents={monthEvents}
        listEvents={listEvents}
        cities={cities.map((c) => ({ slug: c.slug, name: c.name, country: c.country }))}
        year={year}
        month={month}
        daysInMonth={daysInMonth}
        monthLabel={monthLabel}
        todayISO={todayISO}
        realYear={realYear}
        realMonth={realMonth}
        view={view}
        tab={tab}
        currentFilters={{ city: searchParams?.city || "", type: searchParams?.type || "", q: searchParams?.q || "" }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(breadcrumbs)) }}
      />
    </>
  );
}
