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
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1">Destination Name</label>
          <input
            value={value.name}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
            placeholder="e.g. Tokyo"
            className="w-full rounded-lg border border-ink-300 px-3 py-2 text-xs font-semibold focus:border-signal focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1">Country</label>
          <input
            value={value.country}
            onChange={(e) => onChange({ ...value, country: e.target.value })}
            placeholder="e.g. Japan"
            className="w-full rounded-lg border border-ink-300 px-3 py-2 text-xs font-semibold focus:border-signal focus:outline-none"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1">URL Slug</label>
        <input
          value={value.slug}
          onChange={(e) => onChange({ ...value, slug: e.target.value.toLowerCase() })}
          placeholder="e.g. tokyo"
          className="w-full rounded-lg border border-ink-300 px-3 py-2 text-xs font-mono focus:border-signal focus:outline-none"
        />
        <p className="mt-1 font-mono text-[10px] text-ink-400">Public destination endpoint: /cities/{value.slug || "slug"}</p>
      </div>
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1">Intro &amp; Bureau Overview</label>
        <textarea
          value={value.intro}
          onChange={(e) => onChange({ ...value, intro: e.target.value })}
          rows={2}
          placeholder="A brief overview of attraction coverage in this city..."
          className="w-full rounded-lg border border-ink-300 px-3 py-2 text-xs focus:border-signal focus:outline-none resize-none leading-relaxed"
        />
      </div>
      <ImageUploadField
        label="Hero Cover Image"
        value={value.heroImage}
        onChange={(url) => onChange({ ...value, heroImage: url })}
        uploadUrl="/api/admin/upload"
      />
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1">Image Alt Text / Photo Credit</label>
        <input
          value={value.heroImageAlt}
          onChange={(e) => onChange({ ...value, heroImageAlt: e.target.value })}
          placeholder="Describe the hero image"
          className="w-full rounded-lg border border-ink-300 px-3 py-2 text-xs focus:border-signal focus:outline-none"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1">Meta Title</label>
          <input
            value={value.metaTitle}
            onChange={(e) => onChange({ ...value, metaTitle: e.target.value })}
            placeholder="Custom title tag"
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
          placeholder="Search snippet summary"
          className="w-full rounded-lg border border-ink-300 px-3 py-2 text-xs focus:border-signal focus:outline-none resize-none"
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
      toast.success("Destination city added.");
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
      toast.success("Destination updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: "Delete this destination bureau?",
      description: "This removes the city page. Articles under it must be reassigned.",
      confirmLabel: "Delete City",
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-ink-100 pb-4">
        <div>
          <h2 className="font-serif text-xl font-black text-ink-950">Destination Bureaus ({cities.length})</h2>
          <p className="mt-0.5 text-xs text-ink-500">Manage global coverage hubs and hero dossiers.</p>
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search destinations..."
          className="w-full sm:w-64 rounded-xl border border-ink-200 bg-white px-3 py-1.5 text-xs focus:border-signal focus:outline-none"
        />
      </div>

      <div className="space-y-3">
        {filteredCities.length === 0 && (
          <div className="rounded-2xl border border-dashed border-ink-300 bg-white p-8 text-center text-xs text-ink-500">
            No destinations match "{query}".
          </div>
        )}
        {filteredCities.map((city) => (
          <div key={city.id} className="rounded-2xl border border-ink-200/80 bg-white p-5 shadow-card">
            {editingId === city.id ? (
              <div className="space-y-4">
                <CityFormFields value={editValue} onChange={setEditValue} />
                <div className="flex gap-2 pt-2 border-t border-ink-100">
                  <button
                    disabled={busy}
                    onClick={() => handleSaveEdit(city.id)}
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
                    <h3 className="font-serif text-lg font-black text-ink-950">
                      {city.name}, {city.country}
                    </h3>
                    <span className="font-mono text-xs text-ink-400">/cities/{city.slug}</span>
                  </div>
                  <p className="mt-1 font-mono text-[11px] text-ink-500">
                    {articleCounts[city.id]?.total ?? 0} total dispatches ·{" "}
                    <strong className="text-emerald-700 font-bold">{articleCounts[city.id]?.published ?? 0} published live</strong>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => startEdit(city)}
                    className="rounded-lg border border-ink-300 bg-paper-50 px-3 py-1.5 text-xs font-bold text-ink-800 hover:bg-paper-100 transition-all"
                  >
                    Edit
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => handleDelete(city.id)}
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

      {/* Add New Destination Container */}
      <div className="rounded-2xl border border-dashed border-ink-300 bg-white p-6 shadow-subtle">
        {creating ? (
          <div className="space-y-4">
            <h3 className="font-serif text-base font-black text-ink-950">Register New Destination Bureau</h3>
            <CityFormFields value={newCity} onChange={setNewCity} />
            <div className="flex gap-2 pt-2 border-t border-ink-100">
              <button
                disabled={busy}
                onClick={handleCreate}
                className="rounded-xl bg-signal px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-card hover:bg-signal-dark transition-all disabled:opacity-60"
              >
                Create Bureau
              </button>
              <button
                onClick={() => {
                  setCreating(false);
                  setNewCity(EMPTY);
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
            <span>+ Register New Destination City</span>
          </button>
        )}
      </div>
    </div>
  );
}
