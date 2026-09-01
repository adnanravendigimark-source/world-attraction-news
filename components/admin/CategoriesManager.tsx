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
      toast.success("Category added.");
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
      title: "Delete this category?",
      description: "Articles using it will become uncategorized.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/categories/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Couldn't delete this category.");
      }
      setCategories((prev) => prev.filter((c) => c.id !== id));
      toast.success("Category deleted.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete this category.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="space-y-2">
        {categories.map((c) => (
          <div key={c.id} className="rounded-lg border border-ink-200 bg-white p-3.5">
            {editingId === c.id ? (
              <div className="space-y-2">
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    value={editValue.name}
                    onChange={(e) => setEditValue({ ...editValue, name: e.target.value })}
                    placeholder="Name"
                    className="rounded-md border border-ink-300 px-3 py-2 text-sm"
                  />
                  <input
                    value={editValue.slug}
                    onChange={(e) => setEditValue({ ...editValue, slug: e.target.value.toLowerCase() })}
                    placeholder="slug"
                    className="rounded-md border border-ink-300 px-3 py-2 text-sm"
                  />
                </div>
                <textarea
                  value={editValue.description}
                  onChange={(e) => setEditValue({ ...editValue, description: e.target.value })}
                  placeholder="Short description (optional)"
                  rows={2}
                  className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
                />
                <div className="flex gap-2">
                  <button
                    disabled={busy}
                    onClick={() => handleSaveEdit(c.id)}
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
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-ink-900">{c.name}</p>
                  <p className="text-xs text-ink-500">
                    /{c.slug} · {articleCounts[c.id] || 0} article{(articleCounts[c.id] || 0) === 1 ? "" : "s"}
                  </p>
                  {c.description && <p className="mt-1 text-xs text-ink-600">{c.description}</p>}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => startEdit(c)}
                    className="rounded-md border border-ink-300 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-ink-50"
                  >
                    Edit
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => handleDelete(c.id)}
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
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Add a Category</p>
        <div className="mt-2 space-y-2">
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setSlug(e.target.value.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-"));
            }}
            placeholder="Category name"
            className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description (optional)"
            rows={2}
            className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
          />
          <button
            disabled={busy || !name || !slug}
            onClick={handleCreate}
            className="rounded-md bg-signal px-4 py-2 text-xs font-semibold text-white hover:bg-signal-dark disabled:opacity-60"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
