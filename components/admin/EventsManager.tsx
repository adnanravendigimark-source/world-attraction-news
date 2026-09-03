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

interface ArticleOption {
  id: string;
  title: string;
  slug: string;
  citySlug: string;
}

interface EventFormState {
  title: string;
  description: string;
  eventDate: string;
  endDate: string;
  location: string;
  cityId: string;
  eventType: EventType;
  image: string;
  imageAlt: string;
  articleId: string;
}

const EMPTY: EventFormState = {
  title: "",
  description: "",
  eventDate: "",
  endDate: "",
  location: "",
  cityId: "",
  eventType: "special",
  image: "",
  imageAlt: "",
  articleId: "",
};

function toFormValue(event: EventItem): EventFormState {
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
    articleId: event.articleId || "",
  };
}

function formatDateBadge(iso: string): { month: string; day: string } {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return { month: "—", day: "—" };
  return {
    month: d.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
    day: String(d.getDate()),
  };
}

export default function EventsManager({
  initialEvents,
  cities,
  articles,
}: {
  initialEvents: EventItem[];
  cities: City[];
  articles: ArticleOption[];
}) {
  const confirm = useConfirm();
  const toast = useToast();
  const [events, setEvents] = useState(initialEvents);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EventFormState>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (typeFilter && e.eventType !== typeFilter) return false;
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        return (
          e.title.toLowerCase().includes(q) ||
          (e.cityName || "").toLowerCase().includes(q) ||
          e.location.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [events, query, typeFilter]);

  function openAddModal() {
    setEditingId(null);
    setForm(EMPTY);
    setModalOpen(true);
  }

  function openEditModal(event: EventItem) {
    setEditingId(event.id);
    setForm(toFormValue(event));
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    setForm(EMPTY);
  }

  function findValidationError(): string | null {
    if (!form.title.trim()) return "Provide an event title.";
    if (!form.eventDate) return "Provide a start date.";
    if (form.endDate && form.endDate < form.eventDate) return "End date can't be before the start date.";
    return null;
  }

  async function handleSave() {
    const validationError = findValidationError();
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setBusy(true);
    const payload = {
      ...form,
      endDate: form.endDate || null,
      cityId: form.cityId || null,
      articleId: form.articleId || null,
    };
    try {
      if (editingId) {
        const res = await fetch(`/api/admin/events/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update event.");
        setEvents((prev) => prev.map((e) => (e.id === editingId ? data.event : e)).sort(sortByDate));
        toast.success("Event updated.");
      } else {
        const res = await fetch("/api/admin/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create event.");
        setEvents((prev) => [...prev, data.event].sort(sortByDate));
        toast.success("Event created.");
      }
      closeModal();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string, title: string) {
    const ok = await confirm({
      title: `Delete ${title}?`,
      description: "This event will no longer appear on the public calendar.",
      confirmLabel: "Delete Event",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/events/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Couldn't delete event.");
      }
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
      {/* Top Filter and Add Action Bar */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700 mr-1">
            ALL EVENTS ({events.length})
          </span>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-[#DC2626] focus:outline-none cursor-pointer"
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
            className="w-48 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-[#DC2626] focus:outline-none"
          />
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="rounded-xl bg-[#DC2626] px-4 py-2 text-xs font-bold text-white shadow-2xs hover:bg-[#B91C1C] transition-all cursor-pointer"
        >
          + Add Event
        </button>
      </div>

      {/* Events List */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-400">
          {events.length === 0 ? "No events created yet." : "No events match your filters."}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200/90 bg-white shadow-2xs divide-y divide-slate-100 overflow-hidden">
          {filtered.map((event) => {
            const badge = formatDateBadge(event.eventDate);
            return (
              <div key={event.id} className="p-4 sm:p-5 flex items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="flex shrink-0 flex-col items-center justify-center h-12 w-12 rounded-lg bg-slate-100 text-slate-900">
                    <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">{badge.month}</span>
                    <span className="text-base font-black">{badge.day}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-slate-900 truncate">{event.title}</h3>
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 shrink-0">
                        {EVENT_TYPES.find((t) => t.value === event.eventType)?.label || event.eventType}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500 truncate">
                      {event.eventDate}
                      {event.endDate && event.endDate !== event.eventDate ? ` → ${event.endDate}` : ""}
                      {event.cityName ? ` · ${event.cityName}` : ""}
                      {event.location ? ` · ${event.location}` : ""}
                      {event.articleSlug ? " · Linked to article" : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEditModal(event)}
                    className="text-xs font-semibold text-slate-700 hover:text-slate-900 transition-colors cursor-pointer"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleDelete(event.id, event.title)}
                    className="text-xs font-semibold text-rose-600 hover:text-rose-700 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Dialog Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={closeModal} />
          <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#DC2626]">
                  {editingId ? "EDIT EVENT" : "NEW EVENT"}
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                  {editingId ? `Edit: ${form.title}` : "Create Calendar Event"}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Event Title *
                  </label>
                  <input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="e.g. Lantern Festival"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-[#DC2626] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Event Type
                  </label>
                  <select
                    value={form.eventType}
                    onChange={(e) => setForm({ ...form, eventType: e.target.value as EventType })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-[#DC2626] focus:outline-none"
                  >
                    {EVENT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    value={form.eventDate}
                    onChange={(e) => setForm({ ...form, eventDate: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-[#DC2626] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                    End Date (optional)
                  </label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    min={form.eventDate || undefined}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-[#DC2626] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Destination City
                  </label>
                  <select
                    value={form.cityId}
                    onChange={(e) => setForm({ ...form, cityId: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-[#DC2626] focus:outline-none"
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
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Location
                </label>
                <input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="e.g. Magic Kingdom, Orlando"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-[#DC2626] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  placeholder="Brief description of the event..."
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-[#DC2626] focus:outline-none resize-none leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Related Article (optional)
                </label>
                <select
                  value={form.articleId}
                  onChange={(e) => setForm({ ...form, articleId: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-[#DC2626] focus:outline-none"
                >
                  <option value="">No related article</option>
                  {articles.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[10px] text-slate-400">Link a published article for readers to learn more.</p>
              </div>

              <ImageUploadField
                label="Event Image"
                value={form.image}
                onChange={(url) => setForm({ ...form, image: url })}
                uploadUrl="/api/admin/upload"
              />

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Image Alt Text
                </label>
                <input
                  value={form.imageAlt}
                  onChange={(e) => setForm({ ...form, imageAlt: e.target.value })}
                  placeholder="Describe image or credit photographer"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-[#DC2626] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleSave}
                className="rounded-lg bg-[#DC2626] px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-2xs hover:bg-[#B91C1C] transition-all disabled:opacity-60 cursor-pointer"
              >
                {busy ? "Saving..." : editingId ? "Save Changes" : "Create Event"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function sortByDate(a: EventItem, b: EventItem): number {
  return a.eventDate < b.eventDate ? -1 : a.eventDate > b.eventDate ? 1 : 0;
}
