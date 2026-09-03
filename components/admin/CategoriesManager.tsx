"use client";

import { useState } from "react";
import Link from "next/link";
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
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState({ name: "", slug: "", description: "" });

  async function handleCreate() {
    if (!name.trim() || !slug.trim()) {
      toast.error("Please enter a category name and slug.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug, description, sortOrder: categories.length }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create category.");
      setCategories((prev) => [...prev, data.category]);
      setName("");
      setSlug("");
      setDescription("");
      setAdding(false);
      toast.success("Category created.");
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
      if (!res.ok) throw new Error(data.error || "Failed to update category.");
      setCategories((prev) => prev.map((c) => (c.id === id ? data.category : c)));
      setEditingId(null);
      toast.success("Category updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string, catName: string) {
    const ok = await confirm({
      title: `Delete ${catName}?`,
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
        throw new Error(data.error || "Failed to delete category.");
      }
      setCategories((prev) => prev.filter((c) => c.id !== id));
      toast.success("Category deleted.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete category.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Top Actions */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-700">
          Editorial Categories ({categories.length})
        </p>
        <button
          type="button"
          onClick={() => setAdding(!adding)}
          className="rounded-lg bg-[#DC2626] px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-[#B91C1C] transition-colors cursor-pointer"
        >
          {adding ? "✕ Close Form" : "+ Add Category"}
        </button>
      </div>

      {/* Add New Category Form */}
      {adding && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
          <div className="border-b border-slate-100 pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              New Category Beat
            </h3>
          </div>
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Category Name *
                </label>
                <input
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (!slug) {
                      setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"));
                    }
                  }}
                  placeholder="e.g. Theme Parks"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-[#DC2626] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  URL Slug *
                </label>
                <input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
                  placeholder="e.g. theme-parks"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-mono text-slate-900 focus:border-[#DC2626] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Brief description of what stories belong in this category..."
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-[#DC2626] focus:outline-none resize-none leading-relaxed"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
            <button
              disabled={busy}
              onClick={handleCreate}
              className="rounded-lg bg-[#DC2626] px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#B91C1C] transition-all disabled:opacity-60 cursor-pointer"
            >
              Create Category
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

      {/* Categories Grid List */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((c) => {
          const isEditing = editingId === c.id;
          const count = articleCounts[c.id] || 0;

          if (isEditing) {
            return (
              <div
                key={c.id}
                className="col-span-full rounded-xl border border-slate-300 bg-white p-5 shadow-2xs space-y-4"
              >
                <div className="border-b border-slate-100 pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    Edit Category: {c.name}
                  </h3>
                </div>
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">Name</label>
                      <input
                        value={editValue.name}
                        onChange={(e) => setEditValue({ ...editValue, name: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">Slug</label>
                      <input
                        value={editValue.slug}
                        onChange={(e) => setEditValue({ ...editValue, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") })}
                        className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-mono text-slate-900"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">Description</label>
                    <textarea
                      rows={2}
                      value={editValue.description}
                      onChange={(e) => setEditValue({ ...editValue, description: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-800 resize-none"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <button
                    disabled={busy}
                    onClick={() => handleSaveEdit(c.id)}
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
              key={c.id}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-bold text-slate-900">{c.name}</h3>
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-mono font-bold text-slate-700">
                    {count} Articles
                  </span>
                </div>
                {c.description && (
                  <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                    {c.description}
                  </p>
                )}
                <p className="text-[11px] font-mono text-slate-400">
                  Slug: /categories/{c.slug}
                </p>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <Link
                  href={`/categories/${c.slug}`}
                  target="_blank"
                  className="text-xs font-semibold text-slate-600 hover:text-[#DC2626]"
                >
                  View Live ↗
                </Link>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => startEdit(c)}
                    className="rounded px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleDelete(c.id, c.name)}
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
