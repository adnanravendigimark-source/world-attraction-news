"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import type { City } from "@/lib/cities";
import type { AttractionWithCity } from "@/lib/attractions";
import ImageUploadField from "@/components/ImageUploadField";
import { useConfirm } from "@/components/ConfirmProvider";
import { useToast } from "@/components/ToastProvider";

interface AttractionFormState {
  cityId: string;
  name: string;
  description: string;
  heroImage: string;
  heroImageAlt: string;
  metaTitle: string;
  metaDescription: string;
  sortOrder: number;
}

const EMPTY: AttractionFormState = {
  cityId: "",
  name: "",
  description: "",
  heroImage: "",
  heroImageAlt: "",
  metaTitle: "",
  metaDescription: "",
  sortOrder: 0,
};

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
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AttractionFormState>(EMPTY);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    if (!selectedCityId) return attractions;
    return attractions.filter((a) => a.cityId === selectedCityId);
  }, [attractions, selectedCityId]);

  function openAddModal() {
    setEditingId(null);
    setForm({
      ...EMPTY,
      cityId: selectedCityId || cities[0]?.id || "",
    });
    setModalOpen(true);
  }

  function openEditModal(attraction: AttractionWithCity) {
    setEditingId(attraction.id);
    setForm({
      cityId: attraction.cityId,
      name: attraction.name,
      description: attraction.description || "",
      heroImage: attraction.heroImage || "",
      heroImageAlt: attraction.heroImageAlt || "",
      metaTitle: attraction.metaTitle || "",
      metaDescription: attraction.metaDescription || "",
      sortOrder: attraction.sortOrder,
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    setForm(EMPTY);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.cityId) {
      toast.error("Please select a destination city and enter an attraction name.");
      return;
    }
    setBusy(true);
    try {
      if (editingId) {
        const res = await fetch(`/api/admin/attractions/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update attraction.");
        setAttractions((prev) =>
          prev.map((a) => (a.id === editingId ? { ...data.attraction, cityName: cities.find((c) => c.id === data.attraction.cityId)?.name || "" } : a))
        );
        toast.success("Attraction updated successfully.");
      } else {
        const res = await fetch("/api/admin/attractions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, sortOrder: attractions.length }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create attraction.");
        const cityName = cities.find((c) => c.id === data.attraction.cityId)?.name || "";
        setAttractions((prev) => [...prev, { ...data.attraction, cityName }]);
        toast.success("Attraction created successfully.");
      }
      closeModal();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    const count = articleCounts[id] || 0;
    if (count > 0) {
      toast.error(`Cannot delete ${name}: ${count} article(s) are assigned to it.`);
      return;
    }

    const ok = await confirm({
      title: `Delete ${name}?`,
      description: "This will permanently remove this landmark attraction.",
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
    <div className="space-y-6">
      {/* Top Filter and Add Action Card */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 shadow-2xs">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
            FILTER DESTINATION:
          </span>
          <select
            value={selectedCityId}
            onChange={(e) => setSelectedCityId(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 focus:border-[#DC2626] focus:outline-none cursor-pointer"
          >
            <option value="">All Destinations ({attractions.length})</option>
            {cities.map((city) => {
              const count = attractions.filter((a) => a.cityId === city.id).length;
              return (
                <option key={city.id} value={city.id}>
                  {city.name} ({count})
                </option>
              );
            })}
          </select>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="rounded-xl bg-[#DC2626] px-4 py-2 text-xs font-bold text-white shadow-2xs hover:bg-[#B91C1C] transition-all cursor-pointer"
        >
          + Add Landmark
        </button>
      </div>

      {/* Attractions Cards Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-400">
          No landmarks found for this destination.
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((attraction) => {
            const count = articleCounts[attraction.id] || 0;
            const cityName = attraction.cityName || cities.find((c) => c.id === attraction.cityId)?.name || "";

            return (
              <div
                key={attraction.id}
                className="rounded-2xl border border-slate-200/90 bg-white overflow-hidden shadow-2xs flex flex-col justify-between hover:shadow-md transition-all"
              >
                {/* Hero Image with City Badge */}
                <div className="relative aspect-[16/9] w-full overflow-hidden bg-slate-100">
                  {attraction.heroImage ? (
                    <Image src={attraction.heroImage} alt={attraction.name} fill className="object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs font-bold text-slate-400">
                      No Photo
                    </div>
                  )}
                  {cityName && (
                    <span className="absolute left-3 bottom-3 rounded-md bg-[#DC2626] px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white shadow-xs">
                      {cityName}
                    </span>
                  )}
                </div>

                {/* Card Body */}
                <div className="p-5 space-y-2 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-base font-bold text-slate-900 leading-snug">
                        {attraction.name}
                      </h3>
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-mono font-medium text-slate-600 shrink-0 text-right">
                        {count} {count === 1 ? "Dispatch" : "Dispatches"}
                      </span>
                    </div>

                    <p className="mt-2 text-xs text-slate-500 line-clamp-2 leading-relaxed min-h-[2rem]">
                      {attraction.description || "No description provided."}
                    </p>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="border-t border-slate-100 px-5 py-3.5 flex items-center justify-end gap-3.5">
                  <button
                    type="button"
                    onClick={() => openEditModal(attraction)}
                    className="text-xs font-semibold text-slate-700 hover:text-slate-900 transition-colors cursor-pointer"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleDelete(attraction.id, attraction.name)}
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

      {/* Edit / Add Dialog Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={closeModal} />
          <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#DC2626]">
                  {editingId ? "EDIT LANDMARK" : "NEW LANDMARK"}
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                  {editingId ? `Edit: ${form.name}` : "Add Landmark Venue"}
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
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Destination City *
                </label>
                <select
                  value={form.cityId}
                  onChange={(e) => setForm({ ...form, cityId: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-[#DC2626] focus:outline-none"
                >
                  <option value="">Select Destination</option>
                  {cities.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}, {c.country}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Attraction Name *
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Universal Epic Universe"
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
                  placeholder="Summary of this attraction..."
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-[#DC2626] focus:outline-none resize-none leading-relaxed"
                />
              </div>

              <ImageUploadField
                label="Cover Image"
                value={form.heroImage}
                onChange={(url) => setForm({ ...form, heroImage: url })}
                uploadUrl="/api/admin/upload"
              />

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Image Alt Text
                </label>
                <input
                  value={form.heroImageAlt}
                  onChange={(e) => setForm({ ...form, heroImageAlt: e.target.value })}
                  placeholder="Describe the cover image"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-[#DC2626] focus:outline-none"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Meta Title
                  </label>
                  <input
                    value={form.metaTitle}
                    onChange={(e) => setForm({ ...form, metaTitle: e.target.value })}
                    placeholder="Custom SEO Title"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-[#DC2626] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Sort Order
                  </label>
                  <input
                    type="number"
                    value={form.sortOrder}
                    onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-mono text-slate-900 focus:border-[#DC2626] focus:outline-none"
                  />
                </div>
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
                {busy ? "Saving..." : editingId ? "Save Changes" : "Add Landmark"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
