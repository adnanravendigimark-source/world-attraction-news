"use client";

import { useState } from "react";
import Link from "next/link";
import type { SitemapConfig } from "@/lib/sitemaps";
import { SITEMAP_TYPES, SITEMAP_TYPE_LABELS, type SitemapType } from "@/lib/sitemapTypes";
import { useConfirm } from "@/components/ConfirmProvider";
import { useToast } from "@/components/ToastProvider";

interface SitemapFormState {
  name: string;
  type: SitemapType;
  path: string;
  enabled: boolean;
}

const EMPTY: SitemapFormState = {
  name: "",
  type: "STATIC",
  path: "",
  enabled: true,
};

const TYPE_BADGE_CLASS: Record<SitemapType, string> = {
  STATIC: "bg-slate-100 text-slate-700",
  COUNTRY: "bg-sky-50 text-sky-700",
  CITY: "bg-emerald-50 text-emerald-700",
  CATEGORY: "bg-amber-50 text-amber-700",
  ARTICLE: "bg-[#DC2626]/10 text-[#DC2626]",
};

export default function SitemapsManager({
  initialSitemaps,
  urlCounts,
}: {
  initialSitemaps: SitemapConfig[];
  urlCounts: Record<string, number>;
}) {
  const confirm = useConfirm();
  const toast = useToast();
  const [sitemaps, setSitemaps] = useState(initialSitemaps);
  const [counts, setCounts] = useState(urlCounts);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SitemapFormState>(EMPTY);
  const [busy, setBusy] = useState(false);

  function openAddModal() {
    setEditingId(null);
    setForm(EMPTY);
    setModalOpen(true);
  }

  function openEditModal(sitemap: SitemapConfig) {
    setEditingId(sitemap.id);
    setForm({
      name: sitemap.name,
      type: sitemap.type,
      path: sitemap.path,
      enabled: sitemap.enabled,
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    setForm(EMPTY);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.path.trim()) {
      toast.error("Please enter a name and a path.");
      return;
    }
    setBusy(true);
    try {
      if (editingId) {
        const res = await fetch(`/api/admin/sitemaps/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update sitemap.");
        setSitemaps((prev) => prev.map((s) => (s.id === editingId ? data.sitemap : s)));
        if (typeof data.count === "number") {
          setCounts((prev) => ({ ...prev, [data.sitemap.id]: data.count }));
        }
        toast.success("Sitemap updated.");
      } else {
        const res = await fetch("/api/admin/sitemaps", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create sitemap.");
        setSitemaps((prev) => [...prev, data.sitemap]);
        if (typeof data.count === "number") {
          setCounts((prev) => ({ ...prev, [data.sitemap.id]: data.count }));
        }
        toast.success("Sitemap created.");
      }
      closeModal();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleEnabled(sitemap: SitemapConfig) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/sitemaps/${sitemap.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !sitemap.enabled }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update sitemap.");
      setSitemaps((prev) => prev.map((s) => (s.id === sitemap.id ? data.sitemap : s)));
      toast.success(data.sitemap.enabled ? "Sitemap enabled." : "Sitemap disabled.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update sitemap.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(sitemap: SitemapConfig) {
    const ok = await confirm({
      title: `Delete "${sitemap.name}"?`,
      description:
        "This only removes the sitemap configuration and its entry from the master sitemap index — it never deletes or changes the underlying content.",
      confirmLabel: "Delete Sitemap",
      danger: true,
    });
    if (!ok) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/admin/sitemaps/${sitemap.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete sitemap.");
      }
      setSitemaps((prev) => prev.filter((s) => s.id !== sitemap.id));
      toast.success("Sitemap deleted.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete sitemap.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
          SITEMAPS ({sitemaps.length})
        </span>
        <button
          type="button"
          onClick={openAddModal}
          className="rounded-xl bg-[#DC2626] px-4 py-2 text-xs font-bold text-white shadow-2xs hover:bg-[#B91C1C] transition-all cursor-pointer"
        >
          + Add Sitemap
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xs">
        {sitemaps.length === 0 ? (
          <div className="p-12 text-center text-slate-400">No sitemaps configured yet.</div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Path</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">URLs</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sitemaps.map((sitemap) => (
                <tr key={sitemap.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/40">
                  <td className="px-5 py-3.5 text-sm font-semibold text-slate-900">{sitemap.name}</td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${TYPE_BADGE_CLASS[sitemap.type]}`}
                    >
                      {SITEMAP_TYPE_LABELS[sitemap.type]}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 font-mono text-xs text-slate-600">{sitemap.path}</td>
                  <td className="px-5 py-3.5">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleToggleEnabled(sitemap)}
                      className={`rounded-md px-2 py-0.5 text-[11px] font-bold transition-colors disabled:opacity-50 cursor-pointer ${
                        sitemap.enabled
                          ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                      }`}
                    >
                      {sitemap.enabled ? "Enabled" : "Disabled"}
                    </button>
                  </td>
                  <td className="px-5 py-3.5 font-mono text-xs text-slate-600">{counts[sitemap.id] ?? "—"}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-3">
                      <Link
                        href={sitemap.path}
                        target="_blank"
                        className="text-xs font-semibold text-slate-600 hover:text-[#DC2626] transition-colors"
                      >
                        View ↗
                      </Link>
                      <button
                        type="button"
                        onClick={() => openEditModal(sitemap)}
                        className="text-xs font-semibold text-slate-700 hover:text-slate-900 transition-colors cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleDelete(sitemap)}
                        className="text-xs font-semibold text-rose-600 hover:text-rose-700 transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={closeModal} />
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#DC2626]">
                  {editingId ? "EDIT SITEMAP" : "NEW SITEMAP"}
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                  {editingId ? `Edit: ${form.name}` : "Add Sitemap"}
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
                  Name *
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Countries"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-[#DC2626] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Type *
                </label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as SitemapType })}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-[#DC2626] focus:outline-none"
                >
                  {SITEMAP_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {SITEMAP_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[10px] text-slate-400">
                  A sitemap's Type strictly controls what it can contain — e.g. a Country sitemap
                  can only ever list Country URLs, never mixed with any other content type. Each of
                  these 5 types is served by its own fixed route; changing an existing row's Type or
                  Path here will not move that route, so it's only safe to rename a row, not retype
                  or repath it.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Path *
                </label>
                <input
                  value={form.path}
                  onChange={(e) => setForm({ ...form, path: e.target.value })}
                  placeholder="/sitemap-country.xml"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-mono text-slate-900 focus:border-[#DC2626] focus:outline-none"
                />
                <p className="mt-1 text-[10px] text-slate-400">
                  Site-relative path this sitemap is served at, e.g. /sitemap-country.xml. Must be
                  unique across every sitemap.
                </p>
              </div>

              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Enabled — included in the master sitemap index
              </label>
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
                {busy ? "Saving..." : editingId ? "Save Changes" : "Create Sitemap"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
