"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
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
    <div className="space-y-3.5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
            Destination City *
          </label>
          <select
            value={value.cityId}
            onChange={(e) => onChange({ ...value, cityId: e.target.value })}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-[#DC2626] focus:outline-none"
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
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
            Landmark / Venue Name *
          </label>
          <input
            value={value.name}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
            placeholder="e.g. Louvre Museum"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-[#DC2626] focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
          Venue Description
        </label>
        <textarea
          value={value.description}
          onChange={(e) => onChange({ ...value, description: e.target.value })}
          rows={2}
          placeholder="Brief description of the landmark venue..."
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-[#DC2626] focus:outline-none resize-none leading-relaxed"
        />
      </div>

      <ImageUploadField
        label="Cover Image"
        value={value.heroImage}
        onChange={(url) => onChange({ ...value, heroImage: url })}
        uploadUrl="/api/admin/upload"
      />

      <div>
        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
          Hero Image Alt Text
        </label>
        <input
          value={value.heroImageAlt}
          onChange={(e) => onChange({ ...value, heroImageAlt: e.target.value })}
          placeholder="Describe image or credit photographer"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-[#DC2626] focus:outline-none"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
            Meta Title
          </label>
          <input
            value={value.metaTitle}
            onChange={(e) => onChange({ ...value, metaTitle: e.target.value })}
            placeholder="Custom SEO title"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-[#DC2626] focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
            Sort Order
          </label>
          <input
            type="number"
            value={value.sortOrder}
            onChange={(e) => onChange({ ...value, sortOrder: Number(e.target.value) })}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-mono text-slate-900 focus:border-[#DC2626] focus:outline-none"
          />
        </div>
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
  const [selectedCityId, setSelectedCityId] = useState("");
  const [adding, setAdding] = useState(false);
  const [newAttraction, setNewAttraction] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    if (!selectedCityId) return attractions;
    return attractions.filter((a) => a.cityId === selectedCityId);
  }, [attractions, selectedCityId]);

  async function handleCreate() {
    if (!newAttraction.name.trim() || !newAttraction.cityId) {
      toast.error("Please select a city and enter an attraction name.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/attractions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newAttraction),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create attraction.");
      setAttractions((prev) => [...prev, data.attraction]);
      setNewAttraction(EMPTY);
      setAdding(false);
      toast.success("Attraction created.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(attraction: AttractionWithCity) {
    setEditingId(attraction.id);
    setEditValue({
      cityId: attraction.cityId,
      name: attraction.name,
      description: attraction.description || "",
      heroImage: attraction.heroImage || "",
      heroImageAlt: attraction.heroImageAlt || "",
      metaTitle: attraction.metaTitle || "",
      metaDescription: attraction.metaDescription || "",
      sortOrder: attraction.sortOrder,
    });
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
      if (!res.ok) throw new Error(data.error || "Failed to update attraction.");
      setAttractions((prev) => prev.map((a) => (a.id === id ? data.attraction : a)));
      setEditingId(null);
      toast.success("Attraction updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    const ok = await confirm({
      title: `Delete ${name}?`,
      description: "Articles tagging this attraction will remain intact (tagged to the city).",
      confirmLabel: "Delete Landmark",
      danger: true,
    });
    if (!ok) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/admin/attractions/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete attraction.");
      }
      setAttractions((prev) => prev.filter((a) => a.id !== id));
      toast.success("Attraction deleted.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete attraction.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Filter & Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold uppercase text-slate-600">Filter Destination:</label>
          <select
            value={selectedCityId}
            onChange={(e) => setSelectedCityId(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-800 focus:border-[#DC2626] focus:bg-white focus:outline-none"
          >
            <option value="">All Destinations ({attractions.length})</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={() => setAdding(!adding)}
          className="rounded-lg bg-[#DC2626] px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-[#B91C1C] transition-colors cursor-pointer"
        >
          {adding ? "✕ Close Form" : "+ Add Landmark"}
        </button>
      </div>

      {/* Add New Attraction Form */}
      {adding && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
          <div className="border-b border-slate-100 pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              New Landmark / Attraction Venue
            </h3>
          </div>
          <AttractionFormFields value={newAttraction} onChange={setNewAttraction} cities={cities} />
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
            <button
              disabled={busy}
              onClick={handleCreate}
              className="rounded-lg bg-[#DC2626] px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#B91C1C] transition-all disabled:opacity-60 cursor-pointer"
            >
              Create Landmark
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Attractions Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-2xs">
          <p className="text-sm font-semibold text-slate-800">No landmarks found.</p>
          <p className="mt-0.5 text-xs text-slate-500">Add landmarks for this destination using the button above.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((attraction) => {
            const isEditing = editingId === attraction.id;
            const count = articleCounts[attraction.id] || 0;

            if (isEditing) {
              return (
                <div
                  key={attraction.id}
                  className="col-span-full rounded-xl border border-slate-300 bg-white p-5 shadow-2xs space-y-4"
                >
                  <div className="border-b border-slate-100 pb-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                      Edit Landmark: {attraction.name}
                    </h3>
                  </div>
                  <AttractionFormFields value={editValue} onChange={setEditValue} cities={cities} />
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                    <button
                      disabled={busy}
                      onClick={() => handleSaveEdit(attraction.id)}
                      className="rounded-lg bg-[#DC2626] px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#B91C1C] transition-all disabled:opacity-60 cursor-pointer"
                    >
                      Save Changes
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={attraction.id}
                className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Thumbnail */}
                  <div className="relative aspect-[16/9] w-full bg-slate-100">
                    {attraction.heroImage ? (
                      <Image src={attraction.heroImage} alt={attraction.name} fill className="object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs font-bold text-slate-400">
                        No Photo
                      </div>
                    )}
                    <span className="absolute bottom-2 left-2 rounded bg-[#DC2626] px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                      {attraction.cityName}
                    </span>
                  </div>

                  {/* Details */}
                  <div className="p-4 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-base font-bold text-slate-900">{attraction.name}</h3>
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-mono font-bold text-slate-700">
                        {count} Dispatches
                      </span>
                    </div>
                    {attraction.description && (
                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                        {attraction.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Action Bar */}
                <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => startEdit(attraction)}
                    className="rounded px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleDelete(attraction.id, attraction.name)}
                    className="rounded px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
