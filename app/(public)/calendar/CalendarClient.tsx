"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Container from "@/components/Container";
import EmptyState from "@/components/EmptyState";
import NewsletterForm from "@/components/NewsletterForm";
import type { EventItem, EventType } from "@/lib/events";

const EVENT_TYPES: { value: EventType; label: string; emoji: string; dotColor: string }[] = [
  { value: "festival", label: "Festival", emoji: "🌸", dotColor: "bg-pink-500" },
  { value: "opening", label: "New Opening", emoji: "🎢", dotColor: "bg-amber-500" },
  { value: "exhibition", label: "Exhibition", emoji: "🎨", dotColor: "bg-blue-500" },
  { value: "special", label: "Special Event", emoji: "🎆", dotColor: "bg-purple-500" },
  { value: "celebration", label: "Celebration", emoji: "🎉", dotColor: "bg-cyan-500" },
];

function dotColorFor(type: EventType): string {
  return EVENT_TYPES.find((t) => t.value === type)?.dotColor || "bg-slate-400";
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

interface CityOption {
  slug: string;
  name: string;
  country: string;
}

export default function CalendarClient({
  monthEvents,
  listEvents,
  cities,
  year,
  month,
  daysInMonth,
  monthLabel,
  todayISO,
  realYear,
  realMonth,
  view,
  tab,
  currentFilters,
}: {
  monthEvents: EventItem[];
  listEvents: EventItem[];
  cities: CityOption[];
  year: number;
  month: number;
  daysInMonth: number;
  monthLabel: string;
  todayISO: string;
  realYear: number;
  realMonth: number;
  view: "month" | "list";
  tab: "upcoming" | "past";
  currentFilters: { city: string; type: string; q: string };
}) {
  const router = useRouter();
  const [searchDraft, setSearchDraft] = useState(currentFilters.q);

  function buildUrl(overrides: Record<string, string | number | undefined>) {
    const params = new URLSearchParams();
    const next = {
      year: String(year),
      month: String(month),
      view,
      tab,
      city: currentFilters.city,
      type: currentFilters.type,
      q: currentFilters.q,
      ...Object.fromEntries(Object.entries(overrides).map(([k, v]) => [k, v === undefined ? "" : String(v)])),
    };
    // Only include non-default, non-empty params to keep URLs clean.
    if (next.year && Number(next.year) !== realYear) params.set("year", next.year);
    if (next.month && Number(next.month) !== realMonth) params.set("month", next.month);
    if (next.view && next.view !== "month") params.set("view", next.view);
    if (next.tab && next.tab !== "upcoming") params.set("tab", next.tab);
    if (next.city) params.set("city", next.city);
    if (next.type) params.set("type", next.type);
    if (next.q) params.set("q", next.q);
    const qs = params.toString();
    return `/calendar${qs ? `?${qs}` : ""}`;
  }

  function navigate(overrides: Record<string, string | number | undefined>) {
    router.push(buildUrl(overrides));
  }

  function goToMonth(y: number, m: number) {
    let ny = y;
    let nm = m;
    if (nm < 1) {
      nm = 12;
      ny -= 1;
    } else if (nm > 12) {
      nm = 1;
      ny += 1;
    }
    navigate({ year: ny, month: nm, view: "month" });
  }

  function applyFilters() {
    navigate({ q: searchDraft });
  }

  function resetFilters() {
    setSearchDraft("");
    navigate({ city: "", type: "", q: "" });
  }

  function jumpToDate(dateValue: string) {
    if (!dateValue) return;
    const [y, m] = dateValue.split("-").map(Number);
    goToMonth(y, m);
  }

  // Real month-grid math for the given year/month — works for any month,
  // not just a hardcoded one.
  const startWeekday = new Date(year, month - 1, 1).getDay(); // 0 = Sun
  const daysInPrevMonth = new Date(year, month - 1, 0).getDate();
  const leadingDays = Array.from({ length: startWeekday }, (_, i) => daysInPrevMonth - startWeekday + i + 1);
  const currentMonthDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const totalCells = leadingDays.length + currentMonthDays.length;
  const trailingCount = (7 - (totalCells % 7)) % 7;
  const trailingDays = Array.from({ length: trailingCount }, (_, i) => i + 1);

  function eventsForDay(day: number): EventItem[] {
    const iso = `${year}-${pad(month)}-${pad(day)}`;
    return monthEvents.filter((e) => iso >= e.eventDate && iso <= (e.endDate || e.eventDate));
  }

  const activeList = view === "list" ? listEvents : [];

  return (
    <div className="bg-white min-h-screen text-[#0B1527]">
      <section className="relative w-full overflow-hidden bg-gradient-to-r from-amber-50 via-white to-orange-50/30 border-b border-slate-200 min-h-[220px] sm:min-h-[250px] flex items-center">
        <div
          className="absolute inset-0 z-0 bg-cover bg-right sm:bg-[center_35%] bg-no-repeat"
          style={{ backgroundImage: `url('/images/cappadocia-balloons.jpg')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-white via-white/95 35% via-white/70 55% to-transparent 80% z-10 hidden sm:block pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-white via-white/90 to-white/40 z-10 sm:hidden pointer-events-none" />

        <Container className="relative z-20 py-8 sm:py-12">
          <div className="max-w-xl">
            <h1 className="font-serif text-3xl sm:text-4xl lg:text-[44px] font-black tracking-tight text-[#0B1527]">
              Calendar
            </h1>
            <p className="mt-2.5 text-xs sm:text-sm md:text-base text-slate-600 leading-relaxed font-medium">
              Your guide to attraction events, festivals, and openings happening around the world.
            </p>
          </div>
        </Container>
      </section>

      <section className="py-8 sm:py-12 bg-slate-50/40">
        <Container>
          <div className="grid gap-8 lg:grid-cols-12 items-start">
            <div className="lg:col-span-8 flex flex-col gap-5">
              {/* Upcoming / Past Toggle — applies to List view */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate({ tab: "upcoming" })}
                  className={`px-4 py-2 rounded-md text-[11px] font-black uppercase tracking-wider transition-all ${
                    tab === "upcoming" ? "bg-[#0B1527] text-white shadow-sm" : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  UPCOMING EVENTS
                </button>
                <button
                  type="button"
                  onClick={() => navigate({ tab: "past" })}
                  className={`px-4 py-2 rounded-md text-[11px] font-black uppercase tracking-wider transition-all ${
                    tab === "past" ? "bg-[#0B1527] text-white shadow-sm" : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  PAST EVENTS
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => goToMonth(realYear, realMonth)}
                    className="px-3 py-1.5 rounded-md border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    TODAY
                  </button>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label="Previous Month"
                      onClick={() => goToMonth(year, month - 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      aria-label="Next Month"
                      onClick={() => goToMonth(year, month + 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
                    >
                      ›
                    </button>
                  </div>
                  <div className="font-sans text-sm sm:text-base font-black text-[#0B1527] ml-2">
                    <span>{monthLabel}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => navigate({ view: "month" })}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                      view === "month" ? "bg-[#0B1527] text-white shadow-sm" : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 20 20">
                      <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                    <span>MONTH</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate({ view: "list" })}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                      view === "list" ? "bg-[#0B1527] text-white shadow-sm" : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                    </svg>
                    <span>LIST</span>
                  </button>
                </div>
              </div>

              {view === "month" ? (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-[11px] font-black uppercase tracking-wider text-slate-600 py-2.5">
                    <div>SUN</div>
                    <div>MON</div>
                    <div>TUE</div>
                    <div>WED</div>
                    <div>THU</div>
                    <div>FRI</div>
                    <div>SAT</div>
                  </div>

                  <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 text-xs">
                    {leadingDays.map((day) => (
                      <div key={`prev-${day}`} className="min-h-[85px] sm:min-h-[105px] p-2 bg-slate-50/40 text-slate-300 font-medium">
                        <span>{day}</span>
                      </div>
                    ))}

                    {currentMonthDays.map((day) => {
                      const dayEvents = eventsForDay(day);
                      const iso = `${year}-${pad(month)}-${pad(day)}`;
                      const isToday = iso === todayISO;

                      return (
                        <div
                          key={`cur-${day}`}
                          className={`min-h-[85px] sm:min-h-[105px] p-2 relative flex flex-col justify-between transition-colors hover:bg-slate-50/70 ${
                            isToday ? "bg-red-50/20" : ""
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            {isToday ? (
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#DC2626] text-white text-[10px] font-black shadow-sm">
                                {day}
                              </span>
                            ) : (
                              <span className="font-bold text-slate-700 text-[11px]">{day}</span>
                            )}
                          </div>

                          {dayEvents.length > 0 && (
                            <div className="mt-1 flex flex-col gap-0.5">
                              {dayEvents.slice(0, 2).map((event) => (
                                <div key={event.id} className="flex items-start gap-1">
                                  <span className={`h-1.5 w-1.5 rounded-full ${dotColorFor(event.eventType)} shrink-0 mt-1`} />
                                  <span className="text-[10px] sm:text-[11px] font-bold text-slate-900 leading-tight line-clamp-2">
                                    {event.title}
                                  </span>
                                </div>
                              ))}
                              {dayEvents.length > 2 && (
                                <span className="text-[9px] text-slate-500 pl-2.5 font-semibold">+{dayEvents.length - 2} more</span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {trailingDays.map((day) => (
                      <div key={`next-${day}`} className="min-h-[85px] sm:min-h-[105px] p-2 bg-slate-50/40 text-slate-300 font-medium">
                        <span>{day}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : activeList.length === 0 ? (
                <EmptyState
                  title={tab === "upcoming" ? "No upcoming events yet" : "No past events on record"}
                  description={
                    currentFilters.city || currentFilters.type || currentFilters.q
                      ? "No events match your current filters. Try clearing them."
                      : "Check back soon — new events are added regularly."
                  }
                  actionLabel={currentFilters.city || currentFilters.type || currentFilters.q ? "Clear filters" : undefined}
                  actionHref={currentFilters.city || currentFilters.type || currentFilters.q ? "/calendar" : undefined}
                />
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-100">
                  {activeList.map((evt) => {
                    const d = new Date(`${evt.eventDate}T00:00:00`);
                    return (
                      <div key={evt.id} className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3.5">
                          <div className="flex flex-col items-center justify-center h-12 w-12 rounded-lg bg-slate-100 text-[#0B1527] shrink-0 font-bold">
                            <span className="text-[9px] uppercase tracking-wider text-slate-500">
                              {d.toLocaleDateString("en-US", { month: "short" })}
                            </span>
                            <span className="text-base font-black text-[#0B1527]">{d.getDate()}</span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`h-2 w-2 rounded-full ${dotColorFor(evt.eventType)}`} />
                              <h3 className="font-bold text-sm text-[#0B1527]">{evt.title}</h3>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {evt.location || evt.cityName || ""}
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 shrink-0">
                          {evt.eventType}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="lg:col-span-4 flex flex-col gap-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
                <h2 className="font-sans text-xs sm:text-sm font-black uppercase tracking-wider text-[#0B1527] mb-4">
                  FILTER EVENTS
                </h2>

                <div className="mb-4">
                  <label htmlFor="search-events" className="block text-xs font-bold text-slate-700 mb-1.5">
                    Search Events
                  </label>
                  <div className="relative">
                    <input
                      id="search-events"
                      type="text"
                      value={searchDraft}
                      onChange={(e) => setSearchDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") applyFilters();
                      }}
                      placeholder="Search for events, places..."
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 pl-9 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#DC2626] focus:bg-white focus:outline-none"
                    />
                    <svg className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="11" cy="11" r="7" />
                      <path strokeLinecap="round" d="m21 21-4.3-4.3" />
                    </svg>
                  </div>
                </div>

                <div className="mb-4">
                  <label htmlFor="type-select" className="block text-xs font-bold text-slate-700 mb-2">
                    Event Type
                  </label>
                  <select
                    id="type-select"
                    value={currentFilters.type}
                    onChange={(e) => navigate({ type: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:border-[#DC2626] focus:bg-white focus:outline-none"
                  >
                    <option value="">All Types</option>
                    {EVENT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.emoji} {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-4">
                  <label htmlFor="destination-select" className="block text-xs font-bold text-slate-700 mb-1.5">
                    Destination
                  </label>
                  <select
                    id="destination-select"
                    value={currentFilters.city}
                    onChange={(e) => navigate({ city: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:border-[#DC2626] focus:bg-white focus:outline-none"
                  >
                    <option value="">All Destinations</option>
                    {cities.map((c) => (
                      <option key={c.slug} value={c.slug}>
                        {c.name}, {c.country}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-5">
                  <label htmlFor="date-select" className="block text-xs font-bold text-slate-700 mb-1.5">
                    Jump to Month
                  </label>
                  <input
                    id="date-select"
                    type="date"
                    onChange={(e) => jumpToDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:border-[#DC2626] focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={applyFilters}
                    className="w-full rounded-lg bg-[#DC2626] py-2.5 text-xs font-black uppercase tracking-wider text-white shadow hover:bg-[#B91C1C] transition-colors"
                  >
                    APPLY FILTERS
                  </button>
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="text-center text-[11px] font-bold text-slate-500 hover:text-slate-800 py-1"
                  >
                    RESET
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                <div className="p-5">
                  <h3 className="font-sans text-sm font-black text-[#0B1527]">Never Miss an Event</h3>
                  <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                    Subscribe to get the latest attraction events and opening dates delivered to your inbox.
                  </p>
                  <div className="mt-3">
                    <NewsletterForm source="calendar" variant="light" />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-5 text-center">
                <p className="text-xs text-slate-500">
                  Run a destination or attraction? <Link href="/write-for-us" className="font-bold text-[#DC2626] hover:underline">Submit your event</Link> to have it featured here.
                </p>
              </div>
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}
