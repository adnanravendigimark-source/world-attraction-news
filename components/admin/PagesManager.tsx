"use client";

import { useState } from "react";
import type { ContactPageConfig, AboutPageConfig, AboutPageStat, AboutPagePillar } from "@/lib/settings";
import { useToast } from "@/components/ToastProvider";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function SaveBar({ dirty, saving, onSave, label }: { dirty: boolean; saving: boolean; onSave: () => void; label: string }) {
  return (
    <div className="sticky bottom-4 flex justify-end">
      <button
        type="button"
        disabled={!dirty || saving}
        onClick={onSave}
        className="rounded-lg bg-[#DC2626] px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-lg hover:bg-[#B91C1C] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        {saving ? "Saving..." : label}
      </button>
    </div>
  );
}

function ContactPageEditor({ initialConfig }: { initialConfig: ContactPageConfig }) {
  const toast = useToast();
  const [config, setConfig] = useState(initialConfig);
  const [saved, setSaved] = useState(initialConfig);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(config) !== JSON.stringify(saved);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/pages/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save Contact page.");
      setConfig(data.config);
      setSaved(data.config);
      toast.success("Contact page updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save Contact page.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6 pb-24">
      <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-3">
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">Badge</label>
          <input
            value={config.badgeText}
            onChange={(e) => setConfig({ ...config, badgeText: e.target.value })}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-[#DC2626] focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">Heading</label>
          <input
            value={config.heading}
            onChange={(e) => setConfig({ ...config, heading: e.target.value })}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-bold text-slate-900 focus:border-[#DC2626] focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">Subtitle</label>
          <textarea
            value={config.subtitle}
            onChange={(e) => setConfig({ ...config, subtitle: e.target.value })}
            rows={2}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-[#DC2626] focus:outline-none resize-none leading-relaxed"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
              Email Card Label
            </label>
            <input
              value={config.emailCardLabel}
              onChange={(e) => setConfig({ ...config, emailCardLabel: e.target.value })}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-[#DC2626] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
              Reply Note
            </label>
            <input
              value={config.replyNote}
              onChange={(e) => setConfig({ ...config, replyNote: e.target.value })}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-[#DC2626] focus:outline-none"
            />
          </div>
        </div>
        <p className="text-[11px] text-slate-400">
          The email address itself is a sitewide value (used for this and every other mailto link on
          the site) and isn&apos;t editable from an admin page yet — ask your developer to update
          CONTACT_EMAIL in lib/site.ts.
        </p>
      </section>

      <SaveBar dirty={dirty} saving={saving} onSave={handleSave} label="Save Contact Page" />
    </div>
  );
}

function AboutPageEditor({ initialConfig }: { initialConfig: AboutPageConfig }) {
  const toast = useToast();
  const [config, setConfig] = useState(initialConfig);
  const [saved, setSaved] = useState(initialConfig);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(config) !== JSON.stringify(saved);

  function updateStat(index: number, updates: Partial<AboutPageStat>) {
    setConfig((prev) => {
      const next = clone(prev);
      next.stats[index] = { ...next.stats[index], ...updates };
      return next;
    });
  }
  function addStat() {
    setConfig((prev) => ({ ...prev, stats: [...prev.stats, { value: "", label: "" }] }));
  }
  function removeStat(index: number) {
    setConfig((prev) => {
      const next = clone(prev);
      next.stats.splice(index, 1);
      return next;
    });
  }

  function updatePillar(index: number, updates: Partial<AboutPagePillar>) {
    setConfig((prev) => {
      const next = clone(prev);
      next.pillars[index] = { ...next.pillars[index], ...updates };
      return next;
    });
  }
  function addPillar() {
    setConfig((prev) => ({ ...prev, pillars: [...prev.pillars, { title: "", body: "" }] }));
  }
  function removePillar(index: number) {
    setConfig((prev) => {
      const next = clone(prev);
      next.pillars.splice(index, 1);
      return next;
    });
  }
  function movePillar(index: number, direction: -1 | 1) {
    setConfig((prev) => {
      const next = clone(prev);
      const target = index + direction;
      if (target < 0 || target >= next.pillars.length) return prev;
      [next.pillars[index], next.pillars[target]] = [next.pillars[target], next.pillars[index]];
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/pages/about", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save About page.");
      setConfig(data.config);
      setSaved(data.config);
      toast.success("About page updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save About page.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6 pb-24">
      {/* Hero */}
      <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">Hero</h2>
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">Badge</label>
          <input
            value={config.badgeText}
            onChange={(e) => setConfig({ ...config, badgeText: e.target.value })}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-[#DC2626] focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">Heading</label>
          <input
            value={config.heading}
            onChange={(e) => setConfig({ ...config, heading: e.target.value })}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-bold text-slate-900 focus:border-[#DC2626] focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">Subtitle</label>
          <textarea
            value={config.subtitle}
            onChange={(e) => setConfig({ ...config, subtitle: e.target.value })}
            rows={2}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-[#DC2626] focus:outline-none resize-none leading-relaxed"
          />
        </div>
      </section>

      {/* Connect box */}
      <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
          &quot;Connect With Us&quot; Box (hero sidebar)
        </h2>
        <input
          value={config.connectBoxTitle}
          onChange={(e) => setConfig({ ...config, connectBoxTitle: e.target.value })}
          placeholder="Title"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-900 focus:border-[#DC2626] focus:outline-none"
        />
        <textarea
          value={config.connectBoxDescription}
          onChange={(e) => setConfig({ ...config, connectBoxDescription: e.target.value })}
          rows={2}
          placeholder="Description"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-[#DC2626] focus:outline-none resize-none leading-relaxed"
        />
        <input
          value={config.connectBoxButtonText}
          onChange={(e) => setConfig({ ...config, connectBoxButtonText: e.target.value })}
          placeholder="Button text"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-[#DC2626] focus:outline-none"
        />
        <p className="text-[11px] text-slate-400">
          The button always emails the site&apos;s sitewide contact address — only its label is editable
          here.
        </p>
      </section>

      {/* Stats */}
      <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">Stat Cards</h2>
            <p className="text-[11px] text-slate-500">
              The first stat (city bureau count) is always live and isn&apos;t listed here — these are the other cards.
            </p>
          </div>
          <button
            type="button"
            onClick={addStat}
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-700 cursor-pointer shrink-0"
          >
            + Add
          </button>
        </div>
        {config.stats.map((stat, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={stat.value}
              onChange={(e) => updateStat(i, { value: e.target.value })}
              placeholder="100%"
              className="w-24 shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:border-[#DC2626] focus:outline-none"
            />
            <input
              value={stat.label}
              onChange={(e) => updateStat(i, { label: e.target.value })}
              placeholder="Label"
              className="flex-1 min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-[#DC2626] focus:outline-none"
            />
            <button
              type="button"
              onClick={() => removeStat(i)}
              aria-label="Remove stat"
              className="h-7 w-7 shrink-0 rounded-lg border border-rose-200 text-rose-500 hover:bg-rose-50 cursor-pointer"
            >
              ✕
            </button>
          </div>
        ))}
      </section>

      {/* Pillars */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">Numbered Sections</h2>
            <p className="text-[11px] text-slate-500">Numbers (01, 02, ...) are automatic based on order.</p>
          </div>
          <button
            type="button"
            onClick={addPillar}
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-700 cursor-pointer"
          >
            + Add Section
          </button>
        </div>
        {config.pillars.map((pillar, i) => (
          <div key={i} className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-2">
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-xs font-bold text-slate-400">{String(i + 1).padStart(2, "0")}</span>
              <input
                value={pillar.title}
                onChange={(e) => updatePillar(i, { title: e.target.value })}
                placeholder="Section title"
                className="flex-1 min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-900 focus:border-[#DC2626] focus:outline-none"
              />
              <button
                type="button"
                disabled={i === 0}
                onClick={() => movePillar(i, -1)}
                aria-label="Move up"
                className="h-7 w-7 shrink-0 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                ▲
              </button>
              <button
                type="button"
                disabled={i === config.pillars.length - 1}
                onClick={() => movePillar(i, 1)}
                aria-label="Move down"
                className="h-7 w-7 shrink-0 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                ▼
              </button>
              <button
                type="button"
                onClick={() => removePillar(i)}
                aria-label="Remove section"
                className="h-7 w-7 shrink-0 rounded-lg border border-rose-200 text-rose-500 hover:bg-rose-50 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <textarea
              value={pillar.body}
              onChange={(e) => updatePillar(i, { body: e.target.value })}
              rows={3}
              placeholder="Section body"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-[#DC2626] focus:outline-none resize-none leading-relaxed"
            />
          </div>
        ))}
      </section>

      {/* Sidebar boxes */}
      <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">&quot;Write for Us&quot; Sidebar Box</h2>
        <input
          value={config.writeForUsBoxTitle}
          onChange={(e) => setConfig({ ...config, writeForUsBoxTitle: e.target.value })}
          placeholder="Title"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-900 focus:border-[#DC2626] focus:outline-none"
        />
        <textarea
          value={config.writeForUsBoxDescription}
          onChange={(e) => setConfig({ ...config, writeForUsBoxDescription: e.target.value })}
          rows={2}
          placeholder="Description"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-[#DC2626] focus:outline-none resize-none leading-relaxed"
        />
        <p className="text-[11px] text-slate-400">Its two buttons always link to /write-for-us and /signup.</p>
      </section>

      <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
          &quot;Editorial Desk Contact&quot; Sidebar Box
        </h2>
        <input
          value={config.contactBoxTitle}
          onChange={(e) => setConfig({ ...config, contactBoxTitle: e.target.value })}
          placeholder="Title"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-900 focus:border-[#DC2626] focus:outline-none"
        />
        <textarea
          value={config.contactBoxDescription}
          onChange={(e) => setConfig({ ...config, contactBoxDescription: e.target.value })}
          rows={2}
          placeholder="Description"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-[#DC2626] focus:outline-none resize-none leading-relaxed"
        />
        <p className="text-[11px] text-slate-400">
          The email address itself is the same sitewide contact address used everywhere else on the
          site, and isn&apos;t editable from an admin page yet.
        </p>
      </section>

      <SaveBar dirty={dirty} saving={saving} onSave={handleSave} label="Save About Page" />
    </div>
  );
}

export default function PagesManager({
  initialContactConfig,
  initialAboutConfig,
}: {
  initialContactConfig: ContactPageConfig;
  initialAboutConfig: AboutPageConfig;
}) {
  const [activeTab, setActiveTab] = useState<"contact" | "about">("contact");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 border-b border-slate-200 pb-4">
        <button
          type="button"
          onClick={() => setActiveTab("contact")}
          className={`rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
            activeTab === "contact" ? "bg-slate-900 text-white shadow-xs" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          Contact Page
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("about")}
          className={`rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
            activeTab === "about" ? "bg-slate-900 text-white shadow-xs" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          About Page
        </button>
      </div>

      {activeTab === "contact" ? (
        <ContactPageEditor initialConfig={initialContactConfig} />
      ) : (
        <AboutPageEditor initialConfig={initialAboutConfig} />
      )}
    </div>
  );
}
