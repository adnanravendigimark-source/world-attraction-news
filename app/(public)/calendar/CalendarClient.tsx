"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Container from "@/components/Container";

interface CalendarEvent {
  id: string;
  day: number;
  title: string;
  location: string;
  type: "festival" | "opening" | "exhibition" | "special" | "celebration";
  color: string;
  dotColor: string;
}

const MAY_2025_EVENTS: CalendarEvent[] = [
  {
    id: "star-wars-edge",
    day: 3,
    title: "Star Wars: Galaxy's Edge Preview",
    location: "Disneyland, CA",
    type: "special",
    color: "text-purple-600",
    dotColor: "bg-purple-500",
  },
  {
    id: "night-lights",
    day: 4,
    title: "Night Lights Festival",
    location: "Gardens by the Bay, Singapore",
    type: "festival",
    color: "text-emerald-600",
    dotColor: "bg-emerald-500",
  },
  {
    id: "harry-potter-season",
    day: 7,
    title: "Harry Potter™ Season Celebration",
    location: "Universal Orlando",
    type: "celebration",
    color: "text-blue-600",
    dotColor: "bg-blue-500",
  },
  {
    id: "epcot-flower",
    day: 10,
    title: "Epcot International Flower & Garden Festival",
    location: "Orlando, FL",
    type: "festival",
    color: "text-pink-600",
    dotColor: "bg-pink-500",
  },
  {
    id: "anne-frank",
    day: 12,
    title: "Anne Frank House Exhibit Opening",
    location: "Amsterdam",
    type: "opening",
    color: "text-amber-600",
    dotColor: "bg-amber-500",
  },
  {
    id: "cannes-film",
    day: 15,
    title: "Cannes Film Festival",
    location: "Cannes, France",
    type: "special",
    color: "text-purple-600",
    dotColor: "bg-purple-500",
  },
  {
    id: "vivid-sydney",
    day: 17,
    title: "Vivid Sydney 2025",
    location: "Sydney, Australia",
    type: "festival",
    color: "text-emerald-600",
    dotColor: "bg-emerald-500",
  },
  {
    id: "tower-london",
    day: 20,
    title: "Tower of London History Weekend",
    location: "London, UK",
    type: "exhibition",
    color: "text-blue-600",
    dotColor: "bg-blue-500",
  },
  {
    id: "park-ride-night",
    day: 23,
    title: "Park & Ride Night Europa-Park",
    location: "Rust, Germany",
    type: "special",
    color: "text-amber-600",
    dotColor: "bg-amber-500",
  },
  {
    id: "memorial-day",
    day: 25,
    title: "Memorial Day Weekend Events",
    location: "Various Parks, USA",
    type: "celebration",
    color: "text-pink-600",
    dotColor: "bg-pink-500",
  },
  {
    id: "tivoli-gardens",
    day: 28,
    title: "Tivoli Gardens Opening Day",
    location: "Copenhagen, Denmark",
    type: "opening",
    color: "text-emerald-600",
    dotColor: "bg-emerald-500",
  },
  {
    id: "la-merce",
    day: 31,
    title: "La Mercè Festival",
    location: "Barcelona, Spain",
    type: "festival",
    color: "text-blue-600",
    dotColor: "bg-blue-500",
  },
];

const EVENT_TYPES = [
  { id: "festival", label: "Festival", emoji: "🌸", color: "text-pink-500" },
  { id: "opening", label: "Opening", emoji: "🎢", color: "text-amber-500" },
  { id: "exhibition", label: "Exhibition", emoji: "🎨", color: "text-blue-500" },
  { id: "special", label: "Special Event", emoji: "🎆", color: "text-purple-500" },
  { id: "celebration", label: "Celebration", emoji: "🎉", color: "text-cyan-500" },
];

const DESTINATIONS = [
  "All Destinations",
  "Orlando, USA",
  "Paris, France",
  "Tokyo, Japan",
  "Singapore",
  "London, UK",
  "Dubai, UAE",
  "Amsterdam, Netherlands",
  "Sydney, Australia",
  "Copenhagen, Denmark",
  "Barcelona, Spain",
];

export default function CalendarClient() {
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [viewMode, setViewMode] = useState<"month" | "list">("month");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedDest, setSelectedDest] = useState("All Destinations");
  const [selectedDate, setSelectedDate] = useState("");
  const [monthName, setMonthName] = useState("May 2025");
  const [subscribed, setSubscribed] = useState(false);

  const toggleType = (typeId: string) => {
    setSelectedTypes((prev) =>
      prev.includes(typeId) ? prev.filter((t) => t !== typeId) : [...prev, typeId]
    );
  };

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedTypes([]);
    setSelectedDest("All Destinations");
    setSelectedDate("");
  };

  // Filter events
  const filteredEvents = MAY_2025_EVENTS.filter((e) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!e.title.toLowerCase().includes(q) && !e.location.toLowerCase().includes(q)) {
        return false;
      }
    }
    if (selectedTypes.length > 0 && !selectedTypes.includes(e.type)) {
      return false;
    }
    if (selectedDest !== "All Destinations") {
      const city = selectedDest.split(",")[0].toLowerCase();
      if (!e.location.toLowerCase().includes(city)) {
        return false;
      }
    }
    return true;
  });

  const getEventForDay = (day: number) => {
    return filteredEvents.find((e) => e.day === day);
  };

  // Calendar days setup: May 2025 starts on Thursday (index 4)
  // Previous month days to display: 27, 28, 29, 30
  // Days of May: 1 to 31
  const prevMonthDays = [27, 28, 29, 30];
  const currentMonthDays = Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <div className="bg-white min-h-screen text-[#0B1527]">
      {/* =========================================
          1. HERO HEADER BANNER (Cappadocia Hot Air Balloons)
      ========================================= */}
      <section className="relative w-full overflow-hidden bg-gradient-to-r from-amber-50 via-white to-orange-50/30 border-b border-slate-200 min-h-[220px] sm:min-h-[250px] flex items-center">
        {/* Background Image on Right */}
        <div 
          className="absolute inset-0 z-0 bg-cover bg-right sm:bg-[center_35%] bg-no-repeat"
          style={{
            backgroundImage: `url('/images/cappadocia-balloons.jpg')`,
          }}
        />

        {/* Gradient Blend: Solid White on Left fading smoothly to photo on Right */}
        <div className="absolute inset-0 bg-gradient-to-r from-white via-white/95 35% via-white/70 55% to-transparent 80% z-10 hidden sm:block pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-white via-white/90 to-white/40 z-10 sm:hidden pointer-events-none" />

        {/* Text Content */}
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

      {/* =========================================
          2. TWO-COLUMN MAIN CONTENT AREA
      ========================================= */}
      <section className="py-8 sm:py-12 bg-slate-50/40">
        <Container>
          <div className="grid gap-8 lg:grid-cols-12 items-start">
            {/* Left Column (68%): Calendar Grid */}
            <div className="lg:col-span-8 flex flex-col gap-5">
              {/* Upcoming / Past Toggle */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTab("upcoming")}
                  className={`px-4 py-2 rounded-md text-[11px] font-black uppercase tracking-wider transition-all ${
                    tab === "upcoming"
                      ? "bg-[#0B1527] text-white shadow-sm"
                      : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  UPCOMING EVENTS
                </button>
                <button
                  type="button"
                  onClick={() => setTab("past")}
                  className={`px-4 py-2 rounded-md text-[11px] font-black uppercase tracking-wider transition-all ${
                    tab === "past"
                      ? "bg-[#0B1527] text-white shadow-sm"
                      : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  PAST EVENTS
                </button>
              </div>

              {/* Month & View Mode Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {}}
                    className="px-3 py-1.5 rounded-md border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    TODAY
                  </button>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label="Previous Month"
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      aria-label="Next Month"
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
                    >
                      ›
                    </button>
                  </div>
                  <div className="font-sans text-sm sm:text-base font-black text-[#0B1527] ml-2 flex items-center gap-1 cursor-pointer">
                    <span>{monthName}</span>
                    <svg className="h-3.5 w-3.5 text-slate-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>

                {/* Month / List Toggle */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setViewMode("month")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                      viewMode === "month"
                        ? "bg-[#0B1527] text-white shadow-sm"
                        : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 20 20">
                      <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                    <span>MONTH</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("list")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                      viewMode === "list"
                        ? "bg-[#0B1527] text-white shadow-sm"
                        : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                    </svg>
                    <span>LIST</span>
                  </button>
                </div>
              </div>

              {/* Month View: Calendar Grid */}
              {viewMode === "month" ? (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  {/* Days Header */}
                  <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-[11px] font-black uppercase tracking-wider text-slate-600 py-2.5">
                    <div>SUN</div>
                    <div>MON</div>
                    <div>TUE</div>
                    <div>WED</div>
                    <div>THU</div>
                    <div>FRI</div>
                    <div>SAT</div>
                  </div>

                  {/* 35 Cells Grid (5 Rows x 7 Cols) */}
                  <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 text-xs">
                    {/* Previous Month Muted Days (27, 28, 29, 30) */}
                    {prevMonthDays.map((day) => (
                      <div key={`prev-${day}`} className="min-h-[85px] sm:min-h-[105px] p-2 bg-slate-50/40 text-slate-300 font-medium">
                        <span>{day}</span>
                      </div>
                    ))}

                    {/* Current Month Days (1 to 31) */}
                    {currentMonthDays.map((day) => {
                      const event = getEventForDay(day);
                      const isToday = day === 14;

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

                          {event && (
                            <div className="mt-1 flex flex-col gap-0.5">
                              <div className="flex items-start gap-1">
                                <span className={`h-1.5 w-1.5 rounded-full ${event.dotColor} shrink-0 mt-1`} />
                                <span className="text-[10px] sm:text-[11px] font-bold text-slate-900 leading-tight line-clamp-2">
                                  {event.title}
                                </span>
                              </div>
                              <span className="text-[9px] text-slate-500 pl-2.5 truncate font-medium">
                                {event.location}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* List View */
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-100">
                  {filteredEvents.map((evt) => (
                    <div key={evt.id} className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3.5">
                        <div className="flex flex-col items-center justify-center h-12 w-12 rounded-lg bg-slate-100 text-[#0B1527] shrink-0 font-bold">
                          <span className="text-[9px] uppercase tracking-wider text-slate-500">MAY</span>
                          <span className="text-base font-black text-[#0B1527]">{evt.day}</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${evt.dotColor}`} />
                            <h3 className="font-bold text-sm text-[#0B1527]">{evt.title}</h3>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">{evt.location}</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                        {evt.type}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* View Full Calendar Button */}
              <div className="mt-2 text-center">
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-6 py-2.5 text-xs font-black uppercase tracking-wider text-[#0B1527] hover:border-[#DC2626] hover:text-[#DC2626] shadow-sm transition-all"
                >
                  <span>VIEW FULL CALENDAR</span>
                  <span aria-hidden="true">→</span>
                </button>
              </div>
            </div>

            {/* Right Column (32%): Filter Sidebar & Newsletter */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              {/* FILTER EVENTS Card */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
                <h2 className="font-sans text-xs sm:text-sm font-black uppercase tracking-wider text-[#0B1527] mb-4">
                  FILTER EVENTS
                </h2>

                {/* Search Events */}
                <div className="mb-4">
                  <label htmlFor="search-events" className="block text-xs font-bold text-slate-700 mb-1.5">
                    Search Events
                  </label>
                  <div className="relative">
                    <input
                      id="search-events"
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search for events, places..."
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 pl-9 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#DC2626] focus:bg-white focus:outline-none"
                    />
                    <svg
                      className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <circle cx="11" cy="11" r="7" />
                      <path strokeLinecap="round" d="m21 21-4.3-4.3" />
                    </svg>
                  </div>
                </div>

                {/* Event Type */}
                <div className="mb-4">
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    Event Type
                  </label>
                  <div className="space-y-2">
                    {EVENT_TYPES.map((t) => (
                      <label key={t.id} className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 hover:text-slate-900">
                        <input
                          type="checkbox"
                          checked={selectedTypes.includes(t.id)}
                          onChange={() => toggleType(t.id)}
                          className="h-3.5 w-3.5 rounded border-slate-300 text-[#DC2626] focus:ring-[#DC2626]"
                        />
                        <span>{t.emoji}</span>
                        <span>{t.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Destination Dropdown */}
                <div className="mb-4">
                  <label htmlFor="destination-select" className="block text-xs font-bold text-slate-700 mb-1.5">
                    Destination
                  </label>
                  <select
                    id="destination-select"
                    value={selectedDest}
                    onChange={(e) => setSelectedDest(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:border-[#DC2626] focus:bg-white focus:outline-none"
                  >
                    {DESTINATIONS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date Picker */}
                <div className="mb-5">
                  <label htmlFor="date-select" className="block text-xs font-bold text-slate-700 mb-1.5">
                    Date
                  </label>
                  <input
                    id="date-select"
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:border-[#DC2626] focus:bg-white focus:outline-none"
                  />
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
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

              {/* "Never Miss an Event" Newsletter Card */}
              <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                <div className="relative h-36 w-full bg-slate-900">
                  <Image
                    src="https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=800&q=80"
                    alt="Attraction Lights at Night"
                    fill
                    sizes="(min-width: 1024px) 30vw, 100vw"
                    className="object-cover opacity-90"
                  />
                </div>
                <div className="p-5">
                  <h3 className="font-sans text-sm font-black text-[#0B1527]">
                    Never Miss an Event
                  </h3>
                  <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                    Subscribe to get the latest attraction events and opening dates delivered to your inbox.
                  </p>
                  {subscribed ? (
                    <div className="mt-3 p-2 bg-emerald-50 text-emerald-700 text-xs font-bold rounded text-center">
                      ✓ Subscribed! You will receive weekly dispatches.
                    </div>
                  ) : (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        setSubscribed(true);
                      }}
                      className="mt-3 flex gap-2"
                    >
                      <input
                        type="email"
                        required
                        placeholder="Enter your email address"
                        className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#DC2626] focus:outline-none"
                      />
                      <button
                        type="submit"
                        className="rounded-md bg-[#DC2626] px-4 py-2 text-xs font-black uppercase text-white hover:bg-[#B91C1C] shadow transition-colors"
                      >
                        SUBSCRIBE
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}
