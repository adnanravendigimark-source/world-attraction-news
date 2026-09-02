"use client";

import { useState } from "react";
import type { Category } from "@/lib/categories";
import { useConfirm } from "@/components/ConfirmProvider";
import { useToast } from "@/components/ToastProvider";

export default function CategoriesManager({
  initialCategories,
  articleCounts,
}: {
  initialCategories: Category[];
  articleCounts: Record<string, number>;
}) {
  const confirm = useConfirm();
  const toast = useToast();
  const [categories, setCategories] = useState(initialCategories);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState({ name: "", slug: "", description: "" });

  async function handleCreate() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug, description, sortOrder: categories.length }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setCategories((prev) => [...prev, data.category]);
      setName("");
      setSlug("");
      setDescription("");
      toast.success("Coverage beat added.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(c: Category) {
    setEditingId(c.id);
    setEditValue({ name: c.name, slug: c.slug, description: c.description });
  }

  async function handleSaveEdit(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editValue),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setCategories((prev) => prev.map((c) => (c.id === id ? data.category : c)));
      setEditingId(null);
      toast.success("Category updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: "Delete this coverage category?",
      description: "Articles in this category will remain intact as uncategorized.",
      confirmLabel: "Delete Category",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/categories/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Couldn't delete category.");
      }
      setCategories((prev) => prev.filter((c) => c.id !== id));
      toast.success("Category deleted.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-ink-100 pb-4">
        <h2 className="font-serif text-xl font-black text-ink-950">Editorial Categories ({categories.length})</h2>
        <p className="mt-0.5 text-xs text-ink-500">Manage beats, theme park sections, and article categories.</p>
      </div>

      <div className="space-y-3">
        {categories.map((c) => (
          <div key={c.id} className="rounded-2xl border border-ink-200/80 bg-white p-5 shadow-card">
            {editingId === c.id ? (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    value={editValue.name}
                    onChange={(e) => setEditValue({ ...editValue, name: e.target.value })}
                    placeholder="Category Name"
                    className="rounded-lg border border-ink-300 px-3 py-2 text-xs font-semibold"
                  />
                  <input
                    value={editValue.slug}
                    onChange={(e) => setEditValue({ ...editValue, slug: e.target.value.toLowerCase() })}
                    placeholder="Slug"
                    className="rounded-lg border border-ink-300 px-3 py-2 text-xs font-mono"
                  />
                </div>
                <textarea
                  value={editValue.description}
                  onChange={(e) => setEditValue({ ...editValue, description: e.target.value })}
                  placeholder="Category description"
                  rows={2}
                  className="w-full rounded-lg border border-ink-300 px-3 py-2 text-xs resize-none"
                />
                <div className="flex gap-2">
                  <button
                    disabled={busy}
                    onClick={() => handleSaveEdit(c.id)}
                    className="rounded-xl bg-ink-950 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-signal transition-all disabled:opacity-60"
                  >
                    Save
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
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-serif text-base font-bold text-ink-950">{c.name}</h3>
                    <span className="font-mono text-xs text-ink-400">/categories/{c.slug}</span>
                  </div>
                  <p className="mt-0.5 font-mono text-[11px] text-ink-500">
                    {articleCounts[c.id] || 0} published dispatches
                  </p>
                  {c.description && <p className="mt-1.5 text-xs text-ink-600 leading-relaxed">{c.description}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => startEdit(c)}
                    className="rounded-lg border border-ink-300 bg-paper-50 px-3 py-1.5 text-xs font-bold text-ink-800 hover:bg-paper-100 transition-all"
                  >
                    Edit
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => handleDelete(c.id)}
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
        <p className="text-xs font-mono font-bold uppercase tracking-widest text-signal mb-2">Create New Beat</p>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setSlug(e.target.value.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-"));
              }}
              placeholder="e.g. Theme Parks & Coasters"
              className="rounded-lg border border-ink-300 px-3 py-2 text-xs font-semibold"
            />
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="theme-parks-coasters"
              className="rounded-lg border border-ink-300 px-3 py-2 text-xs font-mono"
            />
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief scope of this category beat..."
            rows={2}
            className="w-full rounded-lg border border-ink-300 px-3 py-2 text-xs resize-none"
          />
          <button
            disabled={busy || !name || !slug}
            onClick={handleCreate}
            className="rounded-xl bg-signal px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-card hover:bg-signal-dark transition-all disabled:opacity-60"
          >
            Add Category Beat
          </button>
        </div>
      </div>
    </div>
  );
}
