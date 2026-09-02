"use client";

import { useMemo, useState } from "react";
import type { City } from "@/lib/cities";
import type { EventItem, EventType } from "@/lib/events";
import ImageUploadField from "@/components/ImageUploadField";
import { useConfirm } from "@/components/ConfirmProvider";
import { useToast } from "@/components/ToastProvider";

const EVENT_TYPES: { value: EventType; label: string }[] = [
  { value: "festival", label: "Festival" },
  { value: "opening", label: "New Opening" },
  { value: "exhibition", label: "Exhibition" },
  { value: "special", label: "Special Event" },
  { value: "celebration", label: "Celebration" },
];

const EMPTY = {
  title: "",
  description: "",
  eventDate: "",
  endDate: "",
  location: "",
  cityId: "",
  eventType: "special" as EventType,
  image: "",
  imageAlt: "",
};

type FormValue = typeof EMPTY;

function EventFormFields({
  value,
  onChange,
  cities,
}: {
  value: FormValue;
  onChange: (v: FormValue) => void;
  cities: City[];
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1">Event Title</label>
          <input
            value={value.title}
            onChange={(e) => onChange({ ...value, title: e.target.value })}
            placeholder="e.g. Lantern Festival"
            className="w-full rounded-lg border border-ink-300 px-3 py-2 text-xs font-semibold focus:border-signal focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1">Event Type</label>
          <select
            value={value.eventType}
            onChange={(e) => onChange({ ...value, eventType: e.target.value as EventType })}
            className="w-full rounded-lg border border-ink-300 bg-white px-3 py-2 text-xs font-semibold focus:border-signal focus:outline-none"
          >
            {EVENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1">Start Date</label>
          <input
            type="date"
            value={value.eventDate}
            onChange={(e) => onChange({ ...value, eventDate: e.target.value })}
            className="w-full rounded-lg border border-ink-300 px-3 py-2 text-xs font-semibold focus:border-signal focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1">End Date (optional)</label>
          <input
            type="date"
            value={value.endDate}
            onChange={(e) => onChange({ ...value, endDate: e.target.value })}
            className="w-full rounded-lg border border-ink-300 px-3 py-2 text-xs font-semibold focus:border-signal focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1">Destination City</label>
          <select
            value={value.cityId}
            onChange={(e) => onChange({ ...value, cityId: e.target.value })}
            className="w-full rounded-lg border border-ink-300 bg-white px-3 py-2 text-xs font-semibold focus:border-signal focus:outline-none"
          >
            <option value="">No specific city</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}, {c.country}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1">Location</label>
        <input
          value={value.location}
          onChange={(e) => onChange({ ...value, location: e.target.value })}
          placeholder="e.g. Magic Kingdom, Orlando"
          className="w-full rounded-lg border border-ink-300 px-3 py-2 text-xs focus:border-signal focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1">Description</label>
        <textarea
          value={value.description}
          onChange={(e) => onChange({ ...value, description: e.target.value })}
          rows={2}
          placeholder="Brief description of the event..."
          className="w-full rounded-lg border border-ink-300 px-3 py-2 text-xs focus:border-signal focus:outline-none resize-none leading-relaxed"
        />
      </div>
      <ImageUploadField
        label="Event Image"
        value={value.image}
        onChange={(url) => onChange({ ...value, image: url })}
        uploadUrl="/api/admin/upload"
      />
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1">Image Alt Text</label>
        <input
          value={value.imageAlt}
          onChange={(e) => onChange({ ...value, imageAlt: e.target.value })}
          placeholder="Describe image or credit photographer"
          className="w-full rounded-lg border border-ink-300 px-3 py-2 text-xs focus:border-signal focus:outline-none"
        />
      </div>
    </div>
  );
}

function toFormValue(event: EventItem): FormValue {
  return {
    title: event.title,
    description: event.description,
    eventDate: event.eventDate,
    endDate: event.endDate || "",
    location: event.location,
    cityId: event.cityId || "",
    eventType: event.eventType,
    image: event.image,
    imageAlt: event.imageAlt,
  };
}

export default function EventsManager({
  initialEvents,
  cities,
}: {
  initialEvents: EventItem[];
  cities: City[];
}) {
  const confirm = useConfirm();
  const toast = useToast();
  const [events, setEvents] = useState(initialEvents);
  const [creating, setCreating] = useState(false);
  const [newEvent, setNewEvent] = useState<FormValue>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<FormValue>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (typeFilter && e.eventType !== typeFilter) return false;
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        return e.title.toLowerCase().includes(q) || (e.cityName || "").toLowerCase().includes(q) || e.location.toLowerCase().includes(q);
      }
      return true;
    });
  }, [events, query, typeFilter]);

  async function handleCreate() {
    if (!newEvent.title.trim()) return toast.error("Provide an event title.");
    if (!newEvent.eventDate) return toast.error("Provide a start date.");

    setBusy(true);
    try {
      const res = await fetch("/api/admin/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newEvent, endDate: newEvent.endDate || null, cityId: newEvent.cityId || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setEvents((prev) => [data.event, ...prev].sort((a, b) => (a.eventDate < b.eventDate ? 1 : -1)));
      setCreating(false);
      setNewEvent(EMPTY);
      toast.success("Event created.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(event: EventItem) {
    setEditingId(event.id);
    setEditValue(toFormValue(event));
  }

  async function handleSaveEdit(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/events/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...editValue, endDate: editValue.endDate || null, cityId: editValue.cityId || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setEvents((prev) => prev.map((e) => (e.id === id ? data.event : e)));
      setEditingId(null);
      toast.success("Event updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: "Delete this event?",
      description: "This event will no longer appear on the public calendar.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/events/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't delete event.");
      setEvents((prev) => prev.filter((e) => e.id !== id));
      toast.success("Event deleted.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-ink-100 pb-4">
        <div>
          <h2 className="font-serif text-xl font-black text-ink-950">Calendar Events ({events.length})</h2>
          <p className="mt-0.5 text-xs text-ink-500">
            Festivals, ride openings, and seasonal celebrations shown on the public /calendar page.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-xl border border-ink-200 bg-white px-3 py-1.5 text-xs font-semibold"
          >
            <option value="">All Types</option>
            {EVENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search events..."
            className="w-48 rounded-xl border border-ink-200 bg-white px-3 py-1.5 text-xs focus:border-signal focus:outline-none"
          />
        </div>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-ink-300 bg-white p-8 text-center text-xs text-ink-500">
            No events found.
          </div>
        )}
        {filtered.map((event) => (
          <div key={event.id} className="rounded-2xl border border-ink-200/80 bg-white p-5 shadow-card">
            {editingId === event.id ? (
              <div className="space-y-4">
                <EventFormFields value={editValue} onChange={setEditValue} cities={cities} />
                <div className="flex gap-2 pt-2 border-t border-ink-100">
                  <button
                    disabled={busy}
                    onClick={() => handleSaveEdit(event.id)}
                    className="rounded-xl bg-ink-950 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-signal transition-all disabled:opacity-60"
                  >
                    Save Changes
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="rounded-xl border border-ink-300 px-4 py-2 text-xs font-bold text-ink-700 hover:bg-paper-100"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-serif text-lg font-black text-ink-950">{event.title}</h3>
                    <span className="rounded bg-paper-200 px-2 py-0.5 font-mono text-[10px] font-bold text-ink-800">
                      {EVENT_TYPES.find((t) => t.value === event.eventType)?.label || event.eventType}
                    </span>
                  </div>
                  <p className="mt-0.5 font-mono text-[11px] text-ink-400">
                    {event.eventDate}
                    {event.endDate && event.endDate !== event.eventDate ? ` → ${event.endDate}` : ""}
                    {event.cityName ? ` · ${event.cityName}` : ""}
                    {event.location ? ` · ${event.location}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => startEdit(event)}
                    className="rounded-lg border border-ink-300 bg-paper-50 px-3 py-1.5 text-xs font-bold text-ink-800 hover:bg-paper-100 transition-all"
                  >
                    Edit
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => handleDelete(event.id)}
                    className="rounded-lg px-3 py-1.5 text-xs font-bold text-ink-400 hover:text-signal transition-all disabled:opacity-60"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-dashed border-ink-300 bg-white p-6 shadow-subtle">
        {creating ? (
          <div className="space-y-4">
            <h3 className="font-serif text-base font-black text-ink-950">Add New Event</h3>
            <EventFormFields value={newEvent} onChange={setNewEvent} cities={cities} />
            <div className="flex gap-2 pt-2 border-t border-ink-100">
              <button
                disabled={busy}
                onClick={handleCreate}
                className="rounded-xl bg-signal px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-card hover:bg-signal-dark transition-all disabled:opacity-60"
              >
                Create Event
              </button>
              <button
                onClick={() => {
                  setCreating(false);
                  setNewEvent(EMPTY);
                }}
                className="rounded-xl border border-ink-300 px-4 py-2 text-xs font-bold text-ink-700 hover:bg-paper-100"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-signal hover:underline"
          >
            <span>+ Add New Event</span>
          </button>
        )}
      </div>
    </div>
  );
}
