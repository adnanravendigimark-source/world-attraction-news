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
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">City</label>
          <select
            value={value.cityId}
            onChange={(e) => onChange({ ...value, cityId: e.target.value })}
            className="mt-1.5 w-full rounded-md border border-ink-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Select a city...</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}, {c.country}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Attraction Name</label>
          <input
            value={value.name}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
            placeholder="e.g. Rijksmuseum"
            className="mt-1.5 w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Description</label>
        <textarea
          value={value.description}
          onChange={(e) => onChange({ ...value, description: e.target.value })}
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

  const filtered = query.trim()
    ? attractions.filter(
        (a) => a.name.toLowerCase().includes(query.trim().toLowerCase()) || a.cityName.toLowerCase().includes(query.trim().toLowerCase())
      )
    : attractions;

  async function handleCreate() {
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
      toast.success("Attraction added.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(a: AttractionWithCity) {
    setEditingId(a.id);
    setEditValue({
      cityId: a.cityId,
      name: a.name,
      description: a.description,
      heroImage: a.heroImage,
      heroImageAlt: a.heroImageAlt,
      metaTitle: a.metaTitle,
      metaDescription: a.metaDescription,
      sortOrder: a.sortOrder,
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
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setAttractions((prev) => prev.map((a) => (a.id === id ? data.attraction : a)));
      setEditingId(null);
      toast.success("Attraction updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: "Delete this attraction?",
      description: "This cannot be undone.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/attractions/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't delete this attraction.");
      setAttractions((prev) => prev.filter((a) => a.id !== id));
      toast.success("Attraction deleted.");
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
        placeholder="Search attractions or cities..."
        className="mb-4 w-full max-w-xs rounded-md border border-ink-300 px-3 py-1.5 text-xs focus:border-signal focus:outline-none sm:w-64"
      />

      {cities.length === 0 && <p className="mb-4 text-sm text-ink-500">Add a city first before creating attractions.</p>}

      <div className="space-y-3">
        {filtered.length === 0 && (
          <p className="text-sm text-ink-500">
            {attractions.length === 0 ? "No attractions yet — add your first one below." : `No attractions match "${query}".`}
          </p>
        )}
        {filtered.map((a) => (
          <div key={a.id} className="rounded-lg border border-ink-200 bg-white p-4">
            {editingId === a.id ? (
              <div>
                <AttractionFormFields value={editValue} onChange={setEditValue} cities={cities} />
                <div className="mt-3 flex gap-2">
                  <button
                    disabled={busy}
                    onClick={() => handleSaveEdit(a.id)}
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
                  <p className="text-sm font-bold text-ink-900">{a.name}</p>
                  <p className="text-xs text-ink-500">
                    {a.cityName} · /cities/{a.citySlug}/attractions/{a.slug}
                  </p>
                  <p className="mt-0.5 text-[11px] text-ink-400">
                    {articleCounts[a.id] || 0} published article{(articleCounts[a.id] || 0) === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => startEdit(a)}
                    className="rounded-md border border-ink-300 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-ink-50"
                  >
                    Edit
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => handleDelete(a.id)}
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
            <AttractionFormFields value={newAttraction} onChange={setNewAttraction} cities={cities} />
            <div className="mt-3 flex gap-2">
              <button
                disabled={busy || !newAttraction.cityId || !newAttraction.name}
                onClick={handleCreate}
                className="rounded-md bg-signal px-3 py-1.5 text-xs font-semibold text-white hover:bg-signal-dark disabled:opacity-60"
              >
                Create Attraction
              </button>
              <button
                onClick={() => {
                  setCreating(false);
                  setNewAttraction(EMPTY);
                }}
                className="rounded-md border border-ink-300 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-ink-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            disabled={cities.length === 0}
            onClick={() => setCreating(true)}
            className="text-sm font-semibold text-signal hover:underline disabled:opacity-40"
          >
            + Add an Attraction
          </button>
        )}
      </div>
    </div>
  );
}
