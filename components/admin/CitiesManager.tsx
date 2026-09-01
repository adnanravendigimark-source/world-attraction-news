"use client";

import { useState } from "react";
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

function CityFormFields({ value, onChange }: { value: typeof EMPTY; onChange: (v: typeof EMPTY) => void }) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">City Name</label>
          <input
            value={value.name}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
            className="mt-1.5 w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Country</label>
          <input
            value={value.country}
            onChange={(e) => onChange({ ...value, country: e.target.value })}
            className="mt-1.5 w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">URL Slug</label>
        <input
          value={value.slug}
          onChange={(e) => onChange({ ...value, slug: e.target.value.toLowerCase() })}
          placeholder="e.g. barcelona"
          className="mt-1.5 w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
        />
        <p className="mt-1 text-[11px] text-ink-400">Used in the URL: /cities/{value.slug || "your-slug"}</p>
      </div>
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Intro Text</label>
        <textarea
          value={value.intro}
          onChange={(e) => onChange({ ...value, intro: e.target.value })}
          rows={2}
          className="mt-1.5 w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
        />
      </div>
      <ImageUploadField
        label="Hero Image"
        value={value.heroImage}
        onChange={(url) => onChange({ ...value, heroImage: url })}
        uploadUrl="/api/admin/upload"
      />
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Hero Image Alt Text</label>
        <input
          value={value.heroImageAlt}
          onChange={(e) => onChange({ ...value, heroImageAlt: e.target.value })}
          className="mt-1.5 w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Meta Title</label>
          <input
            value={value.metaTitle}
            onChange={(e) => onChange({ ...value, metaTitle: e.target.value })}
            className="mt-1.5 w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Sort Order</label>
          <input
            type="number"
            value={value.sortOrder}
            onChange={(e) => onChange({ ...value, sortOrder: Number(e.target.value) })}
            className="mt-1.5 w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Meta Description</label>
        <textarea
          value={value.metaDescription}
          onChange={(e) => onChange({ ...value, metaDescription: e.target.value })}
          rows={2}
          className="mt-1.5 w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
        />
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
  const [creating, setCreating] = useState(false);
  const [newCity, setNewCity] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<typeof EMPTY>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");

  const filteredCities = query.trim()
    ? cities.filter(
        (c) =>
          c.name.toLowerCase().includes(query.trim().toLowerCase()) ||
          c.country.toLowerCase().includes(query.trim().toLowerCase())
      )
    : cities;

  async function handleCreate() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/cities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCity),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setCities((prev) => [...prev, data.city]);
      setCreating(false);
      setNewCity(EMPTY);
      toast.success("City added.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(city: City) {
    setEditingId(city.id);
    setEditValue({ ...city });
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
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setCities((prev) => prev.map((c) => (c.id === id ? data.city : c)));
      setEditingId(null);
      toast.success("City updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: "Delete this city?",
      description: "This cannot be undone.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/cities/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't delete this city.");
      setCities((prev) => prev.filter((c) => c.id !== id));
      toast.success("City deleted.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search cities..."
        className="mb-4 w-full max-w-xs rounded-md border border-ink-300 px-3 py-1.5 text-xs focus:border-signal focus:outline-none sm:w-64"
      />

      <div className="space-y-3">
        {filteredCities.length === 0 && <p className="text-sm text-ink-500">No cities match "{query}".</p>}
        {filteredCities.map((city) => (
          <div key={city.id} className="rounded-lg border border-ink-200 bg-white p-4">
            {editingId === city.id ? (
              <div>
                <CityFormFields value={editValue} onChange={setEditValue} />
                <div className="mt-3 flex gap-2">
                  <button
                    disabled={busy}
                    onClick={() => handleSaveEdit(city.id)}
                    className="rounded-md bg-ink-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-ink-800 disabled:opacity-60"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="rounded-md border border-ink-300 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-ink-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-ink-900">
                    {city.name}, {city.country}
                  </p>
                  <p className="text-xs text-ink-500">/cities/{city.slug}</p>
                  <p className="mt-0.5 text-[11px] text-ink-400">
                    {articleCounts[city.id]?.total ?? 0} article{(articleCounts[city.id]?.total ?? 0) === 1 ? "" : "s"} ·{" "}
                    {articleCounts[city.id]?.published ?? 0} published
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => startEdit(city)}
                    className="rounded-md border border-ink-300 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-ink-50"
                  >
                    Edit
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => handleDelete(city.id)}
                    className="rounded-md px-3 py-1.5 text-xs font-semibold text-ink-400 hover:text-signal disabled:opacity-60"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-lg border border-dashed border-ink-300 bg-white p-4">
        {creating ? (
          <div>
            <CityFormFields value={newCity} onChange={setNewCity} />
            <div className="mt-3 flex gap-2">
              <button
                disabled={busy}
                onClick={handleCreate}
                className="rounded-md bg-signal px-3 py-1.5 text-xs font-semibold text-white hover:bg-signal-dark disabled:opacity-60"
              >
                Create City
              </button>
              <button
                onClick={() => {
                  setCreating(false);
                  setNewCity(EMPTY);
                }}
                className="rounded-md border border-ink-300 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-ink-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setCreating(true)} className="text-sm font-semibold text-signal hover:underline">
            + Add a City
          </button>
        )}
      </div>
    </div>
  );
}
