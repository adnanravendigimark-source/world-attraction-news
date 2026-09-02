"use client";

import { useState } from "react";
import type { City } from "@/lib/cities";
import type { AttractionWithCity } from "@/lib/attractions";
import ImageUploadField from "@/components/ImageUploadField";
import { useConfirm } from "@/components/ConfirmProvider";
import { useToast } from "@/components/ToastProvider";

const EMPTY = {
  cityId: "",
  name: "",
  description: "",
  heroImage: "",
  heroImageAlt: "",
  metaTitle: "",
  metaDescription: "",
  sortOrder: 0,
};

function AttractionFormFields({
  value,
  onChange,
  cities,
}: {
  value: typeof EMPTY;
  onChange: (v: typeof EMPTY) => void;
  cities: City[];
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1">Destination City</label>
          <select
            value={value.cityId}
            onChange={(e) => onChange({ ...value, cityId: e.target.value })}
            className="w-full rounded-lg border border-ink-300 bg-white px-3 py-2 text-xs font-semibold focus:border-signal focus:outline-none"
          >
            <option value="">Select destination bureau...</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}, {c.country}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1">Landmark / Venue Name</label>
          <input
            value={value.name}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
            placeholder="e.g. Louvre Museum"
            className="w-full rounded-lg border border-ink-300 px-3 py-2 text-xs font-semibold focus:border-signal focus:outline-none"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1">Venue Description</label>
        <textarea
          value={value.description}
          onChange={(e) => onChange({ ...value, description: e.target.value })}
          rows={2}
          placeholder="Brief description of the landmark..."
          className="w-full rounded-lg border border-ink-300 px-3 py-2 text-xs focus:border-signal focus:outline-none resize-none leading-relaxed"
        />
      </div>
      <ImageUploadField
        label="Cover Image"
        value={value.heroImage}
        onChange={(url) => onChange({ ...value, heroImage: url })}
        uploadUrl="/api/admin/upload"
      />
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1">Hero Image Alt Text</label>
        <input
          value={value.heroImageAlt}
          onChange={(e) => onChange({ ...value, heroImageAlt: e.target.value })}
          placeholder="Describe image or credit photographer"
          className="w-full rounded-lg border border-ink-300 px-3 py-2 text-xs focus:border-signal focus:outline-none"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1">Meta Title</label>
          <input
            value={value.metaTitle}
            onChange={(e) => onChange({ ...value, metaTitle: e.target.value })}
            className="w-full rounded-lg border border-ink-300 px-3 py-2 text-xs focus:border-signal focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1">Sort Order</label>
          <input
            type="number"
            value={value.sortOrder}
            onChange={(e) => onChange({ ...value, sortOrder: Number(e.target.value) })}
            className="w-full rounded-lg border border-ink-300 px-3 py-2 text-xs font-mono focus:border-signal focus:outline-none"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1">Meta Description</label>
        <textarea
          value={value.metaDescription}
          onChange={(e) => onChange({ ...value, metaDescription: e.target.value })}
          rows={2}
          className="w-full rounded-lg border border-ink-300 px-3 py-2 text-xs focus:border-signal focus:outline-none resize-none"
        />
      </div>
    </div>
  );
}

export default function AttractionsManager({
  initialAttractions,
  cities,
  articleCounts,
}: {
  initialAttractions: AttractionWithCity[];
  cities: City[];
  articleCounts: Record<string, number>;
}) {
  const confirm = useConfirm();
  const toast = useToast();
  const [attractions, setAttractions] = useState(initialAttractions);
  const [creating, setCreating] = useState(false);
  const [newAttraction, setNewAttraction] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<typeof EMPTY>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedCityId, setSelectedCityId] = useState("");

  const filtered = attractions.filter((a) => {
    if (selectedCityId && a.cityId !== selectedCityId) return false;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      return a.name.toLowerCase().includes(q) || a.cityName.toLowerCase().includes(q);
    }
    return true;
  });

  async function handleCreate() {
    if (!newAttraction.cityId) return toast.error("Select a destination city first.");
    if (!newAttraction.name.trim()) return toast.error("Provide a landmark name.");

    setBusy(true);
    try {
      const res = await fetch("/api/admin/attractions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newAttraction),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setAttractions((prev) => [...prev, data.attraction]);
      setCreating(false);
      setNewAttraction(EMPTY);
      toast.success("Landmark registered.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(attraction: AttractionWithCity) {
    setEditingId(attraction.id);
    setEditValue({ ...attraction });
  }

  async function handleSaveEdit(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/attractions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editValue),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setAttractions((prev) => prev.map((a) => (a.id === id ? data.attraction : a)));
      setEditingId(null);
      toast.success("Landmark updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: "Delete this landmark?",
      description: "Articles tagged with this landmark will remain under the destination city.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/attractions/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't delete landmark.");
      setAttractions((prev) => prev.filter((a) => a.id !== id));
      toast.success("Landmark deleted.");
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
          <h2 className="font-serif text-xl font-black text-ink-950">Landmarks &amp; Venues ({attractions.length})</h2>
          <p className="mt-0.5 text-xs text-ink-500">Manage cultural sites, museums, and theme park venue dossiers.</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedCityId}
            onChange={(e) => setSelectedCityId(e.target.value)}
            className="rounded-xl border border-ink-200 bg-white px-3 py-1.5 text-xs font-semibold"
          >
            <option value="">All Destinations</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search landmarks..."
            className="w-48 rounded-xl border border-ink-200 bg-white px-3 py-1.5 text-xs focus:border-signal focus:outline-none"
          />
        </div>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-ink-300 bg-white p-8 text-center text-xs text-ink-500">
            No landmarks found.
          </div>
        )}
        {filtered.map((attraction) => (
          <div key={attraction.id} className="rounded-2xl border border-ink-200/80 bg-white p-5 shadow-card">
            {editingId === attraction.id ? (
              <div className="space-y-4">
                <AttractionFormFields value={editValue} onChange={setEditValue} cities={cities} />
                <div className="flex gap-2 pt-2 border-t border-ink-100">
                  <button
                    disabled={busy}
                    onClick={() => handleSaveEdit(attraction.id)}
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
                    <h3 className="font-serif text-lg font-black text-ink-950">{attraction.name}</h3>
                    <span className="rounded bg-paper-200 px-2 py-0.5 font-mono text-[10px] font-bold text-ink-800">
                      {attraction.cityName}
                    </span>
                  </div>
                  <p className="mt-0.5 font-mono text-[11px] text-ink-400">
                    /cities/{attraction.citySlug}/attractions/{attraction.slug} · {articleCounts[attraction.id] || 0} reports
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => startEdit(attraction)}
                    className="rounded-lg border border-ink-300 bg-paper-50 px-3 py-1.5 text-xs font-bold text-ink-800 hover:bg-paper-100 transition-all"
                  >
                    Edit
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => handleDelete(attraction.id)}
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
            <h3 className="font-serif text-base font-black text-ink-950">Register New Landmark</h3>
            <AttractionFormFields value={newAttraction} onChange={setNewAttraction} cities={cities} />
            <div className="flex gap-2 pt-2 border-t border-ink-100">
              <button
                disabled={busy}
                onClick={handleCreate}
                className="rounded-xl bg-signal px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-card hover:bg-signal-dark transition-all disabled:opacity-60"
              >
                Create Landmark
              </button>
              <button
                onClick={() => {
                  setCreating(false);
                  setNewAttraction(EMPTY);
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
            <span>+ Register New Landmark / Venue</span>
          </button>
        )}
      </div>
    </div>
  );
}
