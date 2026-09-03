"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { City } from "@/lib/cities";
import ImageUploadField from "@/components/ImageUploadField";
import { useConfirm } from "@/components/ConfirmProvider";
import { useToast } from "@/components/ToastProvider";

const EMPTY = {
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

function CityFormFields({
  value,
  onChange,
}: {
  value: typeof EMPTY;
  onChange: (v: typeof EMPTY) => void;
}) {
  return (
    <div className="space-y-3.5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
            Destination Name *
          </label>
          <input
            value={value.name}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
            placeholder="e.g. Tokyo"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-[#DC2626] focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
            Country *
          </label>
          <input
            value={value.country}
            onChange={(e) => onChange({ ...value, country: e.target.value })}
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
          value={value.slug}
          onChange={(e) => onChange({ ...value, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") })}
          placeholder="e.g. tokyo"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-mono text-slate-900 focus:border-[#DC2626] focus:outline-none"
        />
        <p className="mt-1 text-[10px] text-slate-400">
          Public URL: /destinations/{value.slug || "slug"}
        </p>
      </div>

      <div>
        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
          Intro &amp; Bureau Overview
        </label>
        <textarea
          value={value.intro}
          onChange={(e) => onChange({ ...value, intro: e.target.value })}
          rows={2}
          placeholder="A brief overview of top attractions and coverage in this destination..."
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
          Image Alt Text
        </label>
        <input
          value={value.heroImageAlt}
          onChange={(e) => onChange({ ...value, heroImageAlt: e.target.value })}
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
  const [adding, setAdding] = useState(false);
  const [newCity, setNewCity] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  async function handleCreate() {
    if (!newCity.name.trim() || !newCity.country.trim() || !newCity.slug.trim()) {
      toast.error("Please enter a name, country, and slug.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/cities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCity),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create city.");
      setCities((prev) => [...prev, data.city]);
      setNewCity(EMPTY);
      setAdding(false);
      toast.success("Destination created.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(city: City) {
    setEditingId(city.id);
    setEditValue({
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
  }

  async function handleSaveEdit(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/cities/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editValue),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update city.");
      setCities((prev) => prev.map((c) => (c.id === id ? data.city : c)));
      setEditingId(null);
      toast.success("Destination updated.");
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
        throw new Error(data.error || "Failed to delete city.");
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
    <div className="space-y-4">
      {/* Top Action / Add Toggle */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-700">
          All Destinations ({cities.length})
        </p>
        <button
          type="button"
          onClick={() => setAdding(!adding)}
          className="rounded-lg bg-[#DC2626] px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-[#B91C1C] transition-colors cursor-pointer"
        >
          {adding ? "✕ Close Form" : "+ Add Destination"}
        </button>
      </div>

      {/* Add New Destination Form Card */}
      {adding && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
          <div className="border-b border-slate-100 pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              New Destination Bureau
            </h3>
          </div>
          <CityFormFields value={newCity} onChange={setNewCity} />
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
            <button
              disabled={busy}
              onClick={handleCreate}
              className="rounded-lg bg-[#DC2626] px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#B91C1C] transition-all disabled:opacity-60 cursor-pointer"
            >
              Create Destination
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

      {/* Destinations List Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cities.map((city) => {
          const isEditing = editingId === city.id;
          const counts = articleCounts[city.id] || { total: 0, published: 0 };

          if (isEditing) {
            return (
              <div
                key={city.id}
                className="col-span-full rounded-xl border border-slate-300 bg-white p-5 shadow-2xs space-y-4"
              >
                <div className="border-b border-slate-100 pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    Edit Destination: {city.name}
                  </h3>
                </div>
                <CityFormFields value={editValue} onChange={setEditValue} />
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <button
                    disabled={busy}
                    onClick={() => handleSaveEdit(city.id)}
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
              key={city.id}
              className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between"
            >
              <div>
                {/* Hero Thumbnail */}
                <div className="relative aspect-[16/9] w-full bg-slate-100">
                  {city.heroImage ? (
                    <Image src={city.heroImage} alt={city.name} fill className="object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs font-bold text-slate-400">
                      No Image
                    </div>
                  )}
                  <span className="absolute bottom-2 left-2 rounded bg-black/75 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                    {city.country}
                  </span>
                </div>

                {/* City Details */}
                <div className="p-4 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-base font-bold text-slate-900">{city.name}</h3>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-mono font-bold text-slate-700">
                      {counts.published} Live / {counts.total} Total
                    </span>
                  </div>
                  {city.intro && (
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                      {city.intro}
                    </p>
                  )}
                  <p className="text-[11px] font-mono text-slate-400">
                    Slug: /destinations/{city.slug}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                <Link
                  href={`/destinations/${city.slug}`}
                  target="_blank"
                  className="text-xs font-semibold text-slate-600 hover:text-[#DC2626]"
                >
                  View Live ↗
                </Link>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => startEdit(city)}
                    className="rounded px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleDelete(city.id, city.name)}
                    className="rounded px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
