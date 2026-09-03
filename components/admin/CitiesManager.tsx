"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { City } from "@/lib/cities";
import ImageUploadField from "@/components/ImageUploadField";
import { useConfirm } from "@/components/ConfirmProvider";
import { useToast } from "@/components/ToastProvider";

interface CityFormState {
  slug: string;
  name: string;
  country: string;
  heroImage: string;
  heroImageAlt: string;
  intro: string;
  metaTitle: string;
  metaDescription: string;
  sortOrder: number;
}

const EMPTY: CityFormState = {
  slug: "",
  name: "",
  country: "",
  heroImage: "",
  heroImageAlt: "",
  intro: "",
  metaTitle: "",
  metaDescription: "",
  sortOrder: 0,
};

export default function CitiesManager({
  initialCities,
  articleCounts,
}: {
  initialCities: City[];
  articleCounts: Record<string, { total: number; published: number }>;
}) {
  const confirm = useConfirm();
  const toast = useToast();
  const [cities, setCities] = useState(initialCities);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CityFormState>(EMPTY);
  const [busy, setBusy] = useState(false);

  function openAddModal() {
    setEditingId(null);
    setForm(EMPTY);
    setModalOpen(true);
  }

  function openEditModal(city: City) {
    setEditingId(city.id);
    setForm({
      slug: city.slug,
      name: city.name,
      country: city.country,
      heroImage: city.heroImage || "",
      heroImageAlt: city.heroImageAlt || "",
      intro: city.intro || "",
      metaTitle: city.metaTitle || "",
      metaDescription: city.metaDescription || "",
      sortOrder: city.sortOrder,
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    setForm(EMPTY);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.country.trim() || !form.slug.trim()) {
      toast.error("Please enter a name, country, and URL slug.");
      return;
    }
    setBusy(true);
    try {
      if (editingId) {
        const res = await fetch(`/api/admin/cities/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update destination.");
        setCities((prev) => prev.map((c) => (c.id === editingId ? data.city : c)));
        toast.success("Destination updated successfully.");
      } else {
        const res = await fetch("/api/admin/cities", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, sortOrder: cities.length }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create destination.");
        setCities((prev) => [...prev, data.city]);
        toast.success("Destination created successfully.");
      }
      closeModal();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    const counts = articleCounts[id];
    if (counts && counts.total > 0) {
      toast.error(`Cannot delete ${name}: ${counts.total} article(s) are assigned to it.`);
      return;
    }

    const ok = await confirm({
      title: `Delete ${name}?`,
      description: "This will permanently remove this destination bureau.",
      confirmLabel: "Delete Destination",
      danger: true,
    });
    if (!ok) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/admin/cities/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete destination.");
      }
      setCities((prev) => prev.filter((c) => c.id !== id));
      toast.success("Destination deleted.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete destination.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Action Header Bar */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
          ALL DESTINATIONS ({cities.length})
        </span>
        <button
          type="button"
          onClick={openAddModal}
          className="rounded-xl bg-[#DC2626] px-4 py-2 text-xs font-bold text-white shadow-2xs hover:bg-[#B91C1C] transition-all cursor-pointer"
        >
          + Add Destination
        </button>
      </div>

      {/* Destinations Cards Grid */}
      {cities.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-400">
          No destinations created yet.
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {cities.map((city) => {
            const counts = articleCounts[city.id] || { total: 0, published: 0 };

            return (
              <div
                key={city.id}
                className="rounded-2xl border border-slate-200/90 bg-white overflow-hidden shadow-2xs flex flex-col justify-between hover:shadow-md transition-all"
              >
                {/* Hero Image with Country Badge */}
                <div className="relative aspect-[16/9] w-full overflow-hidden bg-slate-100">
                  {city.heroImage ? (
                    <Image src={city.heroImage} alt={city.name} fill className="object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs font-bold text-slate-400">
                      No Photo
                    </div>
                  )}
                  {city.country && (
                    <span className="absolute left-3 bottom-3 rounded-md bg-black/75 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                      {city.country}
                    </span>
                  )}
                </div>

                {/* Card Body */}
                <div className="p-5 space-y-2 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-base font-bold text-slate-900 leading-tight">
                        {city.name}
                      </h3>
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-mono font-medium text-slate-600 shrink-0">
                        {counts.published} Live / {counts.total} Total
                      </span>
                    </div>

                    <p className="mt-2 text-xs text-slate-500 line-clamp-2 leading-relaxed min-h-[2rem]">
                      {city.intro || "No description set for this destination."}
                    </p>
                  </div>

                  <p className="text-[11px] font-mono text-slate-400 pt-2">
                    Slug: /destinations/{city.slug}
                  </p>
                </div>

                {/* Card Footer Actions */}
                <div className="border-t border-slate-100 px-5 py-3 flex items-center justify-between">
                  <Link
                    href={`/destinations/${city.slug}`}
                    target="_blank"
                    className="text-xs font-semibold text-slate-600 hover:text-[#DC2626] transition-colors"
                  >
                    View Live ↗
                  </Link>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => openEditModal(city)}
                      className="text-xs font-semibold text-slate-700 hover:text-slate-900 transition-colors cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleDelete(city.id, city.name)}
                      className="text-xs font-semibold text-rose-600 hover:text-rose-700 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
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
                  {editingId ? "EDIT DESTINATION" : "NEW DESTINATION"}
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                  {editingId ? `Edit Destination: ${form.name}` : "Create Destination Bureau"}
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
                    Destination Name *
                  </label>
                  <input
                    value={form.name}
                    onChange={(e) => {
                      const val = e.target.value;
                      setForm((prev) => ({
                        ...prev,
                        name: val,
                        slug: !editingId && !prev.slug ? val.toLowerCase().replace(/\s+/g, "-") : prev.slug,
                      }));
                    }}
                    placeholder="e.g. Tokyo"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-[#DC2626] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Country *
                  </label>
                  <input
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                    placeholder="e.g. Japan"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-[#DC2626] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  URL Slug *
                </label>
                <input
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") })}
                  placeholder="e.g. tokyo"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-mono text-slate-900 focus:border-[#DC2626] focus:outline-none"
                />
                <p className="mt-1 text-[10px] text-slate-400">
                  Public URL: /destinations/{form.slug || "slug"}
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Overview Summary
                </label>
                <textarea
                  value={form.intro}
                  onChange={(e) => setForm({ ...form, intro: e.target.value })}
                  rows={2}
                  placeholder="Brief summary of coverage and key attractions in this city..."
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
                {busy ? "Saving..." : editingId ? "Save Changes" : "Create Destination"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
