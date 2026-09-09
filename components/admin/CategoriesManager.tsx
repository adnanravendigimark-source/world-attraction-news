"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Category } from "@/lib/categories";
import ImageUploadField from "@/components/ImageUploadField";
import { useConfirm } from "@/components/ConfirmProvider";
import { useToast } from "@/components/ToastProvider";

interface CategoryFormState {
  name: string;
  slug: string;
  description: string;
  image: string;
  imageAlt: string;
  metaTitle: string;
  metaDescription: string;
}

const EMPTY: CategoryFormState = {
  name: "",
  slug: "",
  description: "",
  image: "",
  imageAlt: "",
  metaTitle: "",
  metaDescription: "",
};

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
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CategoryFormState>(EMPTY);
  const [busy, setBusy] = useState(false);

  function openAddModal() {
    setEditingId(null);
    setForm(EMPTY);
    setModalOpen(true);
  }

  function openEditModal(category: Category) {
    setEditingId(category.id);
    setForm({
      name: category.name,
      slug: category.slug,
      description: category.description || "",
      image: category.image || "",
      imageAlt: category.imageAlt || "",
      metaTitle: category.metaTitle || "",
      metaDescription: category.metaDescription || "",
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    setForm(EMPTY);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.slug.trim()) {
      toast.error("Please enter a category name and URL slug.");
      return;
    }
    setBusy(true);
    try {
      if (editingId) {
        const res = await fetch(`/api/admin/categories/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update category.");
        setCategories((prev) => prev.map((c) => (c.id === editingId ? data.category : c)));
        toast.success("Category updated successfully.");
      } else {
        const res = await fetch("/api/admin/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, sortOrder: categories.length }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create category.");
        setCategories((prev) => [...prev, data.category]);
        toast.success("Category created successfully.");
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
      description: "This will permanently remove this editorial category.",
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
    <div className="space-y-6">
      {/* Top Action Header Bar */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
          EDITORIAL CATEGORIES ({categories.length})
        </span>
        <button
          type="button"
          onClick={openAddModal}
          className="rounded-xl bg-[#DC2626] px-4 py-2 text-xs font-bold text-white shadow-2xs hover:bg-[#B91C1C] transition-all cursor-pointer"
        >
          + Add Category
        </button>
      </div>

      {/* Categories Cards Grid */}
      {categories.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-400">
          No categories created yet.
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => {
            const count = articleCounts[category.id] || 0;

            return (
              <div
                key={category.id}
                className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xs flex flex-col justify-between hover:shadow-md transition-all"
              >
                {/* Category Thumbnail / Cover */}
                {category.image ? (
                  <div className="relative h-36 w-full bg-slate-100 border-b border-slate-100 overflow-hidden">
                    <Image
                      src={category.image}
                      alt={category.imageAlt || category.name}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                  </div>
                ) : (
                  <div className="h-16 w-full bg-gradient-to-r from-slate-100 to-slate-50 border-b border-slate-100 flex items-center px-6">
                    <span className="text-xs font-semibold text-slate-400">No cover image</span>
                  </div>
                )}

                {/* Card Top Body */}
                <div className="p-6 space-y-2 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-base font-bold text-slate-900 leading-tight">
                        {category.name}
                      </h3>
                      <span className="rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-mono font-medium text-slate-600 shrink-0">
                        {count} {count === 1 ? "Article" : "Articles"}
                      </span>
                    </div>

                    <p className="mt-2 text-xs text-slate-500 line-clamp-2 leading-relaxed min-h-[2rem]">
                      {category.description || "No description set for this category."}
                    </p>
                  </div>

                  <p className="text-[11px] font-mono text-slate-400 pt-2">
                    Slug: /categories/{category.slug}
                  </p>
                </div>

                {/* Card Footer Actions */}
                <div className="border-t border-slate-100 px-6 py-3.5 flex items-center justify-between bg-slate-50/50">
                  <Link
                    href={`/categories/${category.slug}`}
                    target="_blank"
                    className="text-xs font-semibold text-slate-600 hover:text-[#DC2626] transition-colors"
                  >
                    View Live ↗
                  </Link>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => openEditModal(category)}
                      className="text-xs font-semibold text-slate-700 hover:text-slate-900 transition-colors cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleDelete(category.id, category.name)}
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
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#DC2626]">
                  {editingId ? "EDIT CATEGORY" : "NEW CATEGORY"}
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                  {editingId ? `Edit: ${form.name}` : "Create Category Beat"}
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
                  Category Name *
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
                  placeholder="e.g. Theme Parks"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-[#DC2626] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  URL Slug *
                </label>
                <input
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") })}
                  placeholder="e.g. theme-parks"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-mono text-slate-900 focus:border-[#DC2626] focus:outline-none"
                />
                <p className="mt-1 text-[10px] text-slate-400">
                  Public URL: /categories/{form.slug || "slug"}
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  placeholder="What stories fall under this category..."
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-[#DC2626] focus:outline-none resize-none leading-relaxed"
                />
              </div>

              <ImageUploadField
                label="Category Cover Image"
                value={form.image}
                onChange={(url) => setForm({ ...form, image: url })}
                altValue={form.imageAlt}
                onAltChange={(alt) => setForm({ ...form, imageAlt: alt })}
                altLabel="Category Cover Image Alt Text"
                altPlaceholder={`Describe category cover photo (e.g. Theme park roller coaster for ${form.name || "this category"})`}
                uploadUrl="/api/admin/upload"
              />

              <div className="space-y-3 pt-2 border-t border-slate-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  SEO & Search Metadata
                </span>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Meta Title (SEO)
                  </label>
                  <input
                    value={form.metaTitle}
                    onChange={(e) => setForm({ ...form, metaTitle: e.target.value })}
                    placeholder="Custom SEO Title (defaults to category name)"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-[#DC2626] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Meta Description (SEO)
                  </label>
                  <textarea
                    value={form.metaDescription}
                    onChange={(e) => setForm({ ...form, metaDescription: e.target.value })}
                    rows={2}
                    placeholder="Brief summary for search engines (defaults to category description)"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-[#DC2626] focus:outline-none resize-none leading-relaxed"
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
                {busy ? "Saving..." : editingId ? "Save Changes" : "Create Category"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
