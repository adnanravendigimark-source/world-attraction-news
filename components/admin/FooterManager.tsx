"use client";

import { useState } from "react";
import type { FooterConfig, FooterColumn, FooterLink } from "@/lib/settings";
import { useToast } from "@/components/ToastProvider";

function cloneConfig(config: FooterConfig): FooterConfig {
  return JSON.parse(JSON.stringify(config));
}

export default function FooterManager({ initialConfig }: { initialConfig: FooterConfig }) {
  const toast = useToast();
  const [config, setConfig] = useState<FooterConfig>(initialConfig);
  const [savedConfig, setSavedConfig] = useState<FooterConfig>(initialConfig);
  const [saving, setSaving] = useState(false);

  const dirty = JSON.stringify(config) !== JSON.stringify(savedConfig);

  function updateColumn(colIndex: number, updates: Partial<FooterColumn>) {
    setConfig((prev) => {
      const next = cloneConfig(prev);
      next.columns[colIndex] = { ...next.columns[colIndex], ...updates };
      return next;
    });
  }

  function updateLink(colIndex: number, linkIndex: number, updates: Partial<FooterLink>) {
    setConfig((prev) => {
      const next = cloneConfig(prev);
      next.columns[colIndex].links[linkIndex] = { ...next.columns[colIndex].links[linkIndex], ...updates };
      return next;
    });
  }

  function addLink(colIndex: number) {
    setConfig((prev) => {
      const next = cloneConfig(prev);
      next.columns[colIndex].links.push({ label: "", href: "" });
      return next;
    });
  }

  function removeLink(colIndex: number, linkIndex: number) {
    setConfig((prev) => {
      const next = cloneConfig(prev);
      next.columns[colIndex].links.splice(linkIndex, 1);
      return next;
    });
  }

  function moveLink(colIndex: number, linkIndex: number, direction: -1 | 1) {
    setConfig((prev) => {
      const next = cloneConfig(prev);
      const links = next.columns[colIndex].links;
      const target = linkIndex + direction;
      if (target < 0 || target >= links.length) return prev;
      [links[linkIndex], links[target]] = [links[target], links[linkIndex]];
      return next;
    });
  }

  function addColumn() {
    setConfig((prev) => {
      const next = cloneConfig(prev);
      next.columns.push({ title: "NEW COLUMN", links: [] });
      return next;
    });
  }

  function removeColumn(colIndex: number) {
    setConfig((prev) => {
      const next = cloneConfig(prev);
      next.columns.splice(colIndex, 1);
      return next;
    });
  }

  function moveColumn(colIndex: number, direction: -1 | 1) {
    setConfig((prev) => {
      const next = cloneConfig(prev);
      const target = colIndex + direction;
      if (target < 0 || target >= next.columns.length) return prev;
      [next.columns[colIndex], next.columns[target]] = [next.columns[target], next.columns[colIndex]];
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/footer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save footer.");
      setConfig(data.config);
      setSavedConfig(data.config);
      toast.success("Footer updated — the public site now reflects this.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save footer.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6 pb-24">
      {/* About text */}
      <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">About Text</h2>
        <p className="text-[11px] text-slate-500">Shown under the logo in the footer&apos;s first column.</p>
        <textarea
          value={config.about}
          onChange={(e) => setConfig({ ...config, about: e.target.value })}
          rows={3}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-[#DC2626] focus:outline-none resize-none leading-relaxed"
        />
      </section>

      {/* Social links */}
      <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-3">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">Social Links</h2>
          <p className="text-[11px] text-slate-500">Leave a field blank to hide that icon from the footer.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ["facebook", "Facebook"],
              ["twitter", "X / Twitter"],
              ["instagram", "Instagram"],
              ["youtube", "YouTube"],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                {label}
              </label>
              <input
                value={config.social[key]}
                onChange={(e) => setConfig({ ...config, social: { ...config.social, [key]: e.target.value } })}
                placeholder={`https://${key}.com/yourpage`}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-[#DC2626] focus:outline-none"
              />
            </div>
          ))}
        </div>
      </section>

      {/* Link columns */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">Link Columns</h2>
            <p className="text-[11px] text-slate-500">The column titles and links shown across the footer.</p>
          </div>
          <button
            type="button"
            onClick={addColumn}
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-700 cursor-pointer"
          >
            + Add Column
          </button>
        </div>

        {config.columns.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-xs text-slate-400">
            No columns yet — add one above.
          </div>
        ) : (
          config.columns.map((col, colIndex) => (
            <div key={colIndex} className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-3">
              <div className="flex items-center gap-2">
                <input
                  value={col.title}
                  onChange={(e) => updateColumn(colIndex, { title: e.target.value })}
                  placeholder="COLUMN TITLE"
                  className="flex-1 min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-900 focus:border-[#DC2626] focus:outline-none"
                />
                <button
                  type="button"
                  disabled={colIndex === 0}
                  onClick={() => moveColumn(colIndex, -1)}
                  aria-label="Move column left"
                  className="h-7 w-7 shrink-0 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >
                  ◀
                </button>
                <button
                  type="button"
                  disabled={colIndex === config.columns.length - 1}
                  onClick={() => moveColumn(colIndex, 1)}
                  aria-label="Move column right"
                  className="h-7 w-7 shrink-0 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >
                  ▶
                </button>
                <button
                  type="button"
                  onClick={() => removeColumn(colIndex)}
                  aria-label="Remove column"
                  className="h-7 w-7 shrink-0 rounded-lg border border-rose-200 text-rose-500 hover:bg-rose-50 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-2">
                {col.links.map((link, linkIndex) => (
                  <div key={linkIndex} className="flex flex-col sm:flex-row sm:items-center gap-1.5">
                    <div className="flex flex-1 min-w-0 flex-col sm:flex-row gap-1.5">
                      <input
                        value={link.label}
                        onChange={(e) => updateLink(colIndex, linkIndex, { label: e.target.value })}
                        placeholder="Label"
                        className="w-full sm:w-1/2 min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-[#DC2626] focus:outline-none"
                      />
                      <input
                        value={link.href}
                        onChange={(e) => updateLink(colIndex, linkIndex, { href: e.target.value })}
                        placeholder="/path or https://..."
                        className="w-full sm:w-1/2 min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-mono text-slate-800 focus:border-[#DC2626] focus:outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                      <button
                        type="button"
                        disabled={linkIndex === 0}
                        onClick={() => moveLink(colIndex, linkIndex, -1)}
                        aria-label="Move link up"
                        className="h-7 w-7 shrink-0 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        disabled={linkIndex === col.links.length - 1}
                        onClick={() => moveLink(colIndex, linkIndex, 1)}
                        aria-label="Move link down"
                        className="h-7 w-7 shrink-0 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      >
                        ▼
                      </button>
                      <button
                        type="button"
                        onClick={() => removeLink(colIndex, linkIndex)}
                        aria-label="Remove link"
                        className="h-7 w-7 shrink-0 rounded-lg border border-rose-200 text-rose-500 hover:bg-rose-50 cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => addLink(colIndex)}
                className="text-xs font-bold text-[#DC2626] hover:underline cursor-pointer"
              >
                + Add Link
              </button>
            </div>
          ))
        )}
      </section>

      {/* Copyright */}
      <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">Copyright Line</h2>
        <p className="text-[11px] text-slate-500">
          Use <code className="rounded bg-slate-100 px-1 py-0.5">{"{year}"}</code> for the current year — it updates
          automatically and never needs editing again.
        </p>
        <input
          value={config.copyrightText}
          onChange={(e) => setConfig({ ...config, copyrightText: e.target.value })}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-[#DC2626] focus:outline-none"
        />
      </section>

      {/* Save bar */}
      <div className="sticky bottom-4 flex justify-end">
        <button
          type="button"
          disabled={!dirty || saving}
          onClick={handleSave}
          className="rounded-lg bg-[#DC2626] px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-lg hover:bg-[#B91C1C] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {saving ? "Saving..." : "Save Footer"}
        </button>
      </div>
    </div>
  );
}
