"use client";

import { useMemo, useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import type { City } from "@/lib/cities";
import type { Country } from "@/lib/countries";
import { cityPath, countryPath } from "@/lib/destinations";
import { slugifyCountry } from "@/lib/countries";
import ImageUploadField from "@/components/ImageUploadField";
import CityAutocomplete, { type CitySelection } from "@/components/CityAutocomplete";
import { useConfirm } from "@/components/ConfirmProvider";
import { useToast } from "@/components/ToastProvider";

// Deliberately has NO country description/overview/meta fields. Country
// information (intro, hero image, meta title/description) lives only in the
// `countries` table and is edited only from the Country Hubs tab's own
// modal (see editingCountry/handleSaveCountry below) — that is the single
// source of truth. A destination just references a country by name/slug;
// it never carries or duplicates that country's description data.
interface CityFormState {
  slug: string;
  name: string;
  country: string;
  heroImage: string;
  heroImageAlt: string;
  intro: string;
  metaTitle: string;
  metaDescription: string;
  sortOrder: number;
}

interface CountryFormState {
  slug: string;
  name: string;
  intro: string;
  heroImage: string;
  heroImageAlt: string;
  metaTitle: string;
  metaDescription: string;
}

function generateSlug(cityName: string): string {
  return cityName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

const EMPTY_CITY_FORM: CityFormState = {
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

const EMPTY_COUNTRY_FORM: CountryFormState = {
  slug: "",
  name: "",
  intro: "",
  heroImage: "",
  heroImageAlt: "",
  metaTitle: "",
  metaDescription: "",
};

export default function CitiesManager({
  initialCities,
  initialCountries = [],
  articleCounts,
}: {
  initialCities: City[];
  initialCountries?: Country[];
  articleCounts: Record<string, { total: number; published: number }>;
}) {
  const confirm = useConfirm();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<"cities" | "countries">("cities");
  const [cities, setCities] = useState<City[]>(initialCities);
  const [countries, setCountries] = useState<Country[]>(initialCountries);

  // City modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CityFormState>(EMPTY_CITY_FORM);

  // Country modal state
  const [countryModalOpen, setCountryModalOpen] = useState(false);
  const [editingCountry, setEditingCountry] = useState<CountryFormState>(EMPTY_COUNTRY_FORM);

  const [busy, setBusy] = useState(false);

  // Map of slug -> Country object
  const countriesBySlug = useMemo(() => {
    const map = new Map<string, Country>();
    for (const c of countries) {
      if (c && c.slug) {
        map.set(c.slug, c);
      }
    }
    return map;
  }, [countries]);

  // Distinct countries list from cities & countries table
  const distinctCountryList = useMemo(() => {
    const map = new Map<string, { name: string; slug: string; cityCount: number; hasSummary: boolean; countryObj?: Country }>();

    for (const city of cities) {
      const cSlug = city.countrySlug || slugifyCountry(city.country);
      const existing = map.get(cSlug) || {
        name: city.country,
        slug: cSlug,
        cityCount: 0,
        hasSummary: false,
      };
      existing.cityCount += 1;
      map.set(cSlug, existing);
    }

    for (const country of countries) {
      if (!country || !country.slug) continue;
      const existing = map.get(country.slug) || {
        name: country.name,
        slug: country.slug,
        cityCount: 0,
        hasSummary: false,
      };
      existing.hasSummary = Boolean(country.intro?.trim());
      existing.countryObj = country;
      map.set(country.slug, existing);
    }

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [cities, countries]);

  function openAddModal() {
    setEditingId(null);
    setForm(EMPTY_CITY_FORM);
    setModalOpen(true);
  }

  function openEditModal(city: City) {
    setEditingId(city.id);
    setForm({
      slug: city.slug,
      name: city.name,
      country: city.country,
      heroImage: city.heroImage || "",
      heroImageAlt: city.heroImageAlt || "",
      intro: city.intro || "",
      metaTitle: city.metaTitle || "",
      metaDescription: city.metaDescription || "",
      sortOrder: city.sortOrder,
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    setForm(EMPTY_CITY_FORM);
  }

  // Auto-fills the city's own fields when picking a city from autocomplete.
  // Deliberately does NOT touch the `countries` table or fetch/prefill any
  // country description — that data belongs only to the Country Hubs tab.
  function handleCitySelect(selection: CitySelection) {
    const defaultCityIntro = `Explore attraction news, visitor updates, and destination reporting from ${selection.city}, ${selection.country}. Discover the latest on top attractions, theme parks, museums, and historic venues.`;
    const defaultCityMetaTitle = `${selection.city} Destinations — Attraction News & Travel Intelligence`;
    const defaultCityMetaDescription = `Discover the latest attraction news, visitor updates, and destination dispatches from ${selection.city}, ${selection.country}.`;

    setForm((prev) => ({
      ...prev,
      name: selection.city,
      country: selection.country,
      slug: generateSlug(selection.city),
      // Auto-populate editable city intro if empty or when creating new destination
      intro: prev.intro && editingId ? prev.intro : defaultCityIntro,
      metaTitle: prev.metaTitle && editingId ? prev.metaTitle : defaultCityMetaTitle,
      metaDescription: prev.metaDescription && editingId ? prev.metaDescription : defaultCityMetaDescription,
    }));
  }

  function openEditCountryModal(countryInfo: { name: string; slug: string; countryObj?: Country }) {
    const existing = countryInfo.countryObj || countriesBySlug.get(countryInfo.slug);
    setEditingCountry({
      slug: countryInfo.slug,
      name: countryInfo.name,
      intro: existing?.intro || "",
      heroImage: existing?.heroImage || "",
      heroImageAlt: existing?.heroImageAlt || "",
      metaTitle: existing?.metaTitle || "",
      metaDescription: existing?.metaDescription || "",
    });
    setCountryModalOpen(true);
  }

  function closeCountryModal() {
    setCountryModalOpen(false);
    setEditingCountry(EMPTY_COUNTRY_FORM);
  }

  async function handleSaveCity() {
    if (!form.name.trim() || !form.country.trim() || !form.slug.trim()) {
      toast.error("Please enter a name, country, and URL slug.");
      return;
    }
    setBusy(true);
    try {
      // 1. Save City
      if (editingId) {
        const res = await fetch(`/api/admin/cities/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug: form.slug,
            name: form.name,
            country: form.country,
            heroImage: form.heroImage,
            heroImageAlt: form.heroImageAlt,
            intro: form.intro,
            metaTitle: form.metaTitle,
            metaDescription: form.metaDescription,
            sortOrder: form.sortOrder,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update destination.");
        setCities((prev) => prev.map((c) => (c.id === editingId ? data.city : c)));
      } else {
        const res = await fetch("/api/admin/cities", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug: form.slug,
            name: form.name,
            country: form.country,
            heroImage: form.heroImage,
            heroImageAlt: form.heroImageAlt,
            intro: form.intro,
            metaTitle: form.metaTitle,
            metaDescription: form.metaDescription,
            sortOrder: cities.length,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create destination.");
        setCities((prev) => [...prev, data.city]);
      }

      // That's it — a destination save only ever touches the `cities` row.
      // It never creates/updates a `countries` row: country description data
      // has exactly one writer (the Country Hubs tab's own save), so it can
      // never be duplicated or clobbered by editing a destination. If this
      // city's country doesn't have a `countries` row yet, the public
      // country hub page just falls back to a generated overview until an
      // admin adds one from Country Hubs — see handleSaveCountry below.
      toast.success(editingId ? "Destination updated successfully." : "Destination created successfully.");
      closeModal();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveCountry() {
    if (!editingCountry.name.trim()) {
      toast.error("Country name is required.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/countries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingCountry),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update country.");

      setCountries((prev) => {
        const filtered = prev.filter((c) => c.slug !== data.country.slug);
        return [...filtered, data.country];
      });

      toast.success("Country hub overview updated successfully.");
      closeCountryModal();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update country.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteCity(id: string, name: string) {
    const counts = articleCounts[id];
    if (counts && counts.total > 0) {
      toast.error(`Cannot delete ${name}: ${counts.total} article(s) are assigned to it.`);
      return;
    }

    const ok = await confirm({
      title: `Delete ${name}?`,
      description: "This will permanently remove this destination bureau.",
      confirmLabel: "Delete Destination",
      danger: true,
    });
    if (!ok) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/admin/cities/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete destination.");
      }
      setCities((prev) => prev.filter((c) => c.id !== id));
      toast.success("Destination deleted.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete destination.");
    } finally {
      setBusy(false);
    }
  }


  const selectedCountrySlug = form.country ? slugifyCountry(form.country) : "";
  const existingCountryInfo = selectedCountrySlug ? countriesBySlug.get(selectedCountrySlug) : undefined;

  return (
    <div className="space-y-6">
      {/* Top Action Header Bar & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("cities")}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
              activeTab === "cities"
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            City Destinations ({cities.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("countries")}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
              activeTab === "countries"
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Country Hubs ({distinctCountryList.length})
          </button>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="rounded-xl bg-[#DC2626] px-4 py-2 text-xs font-bold text-white shadow-2xs hover:bg-[#B91C1C] transition-all cursor-pointer self-start sm:self-auto"
        >
          + Add Destination
        </button>
      </div>

      {/* =========================================
          TAB 1: CITIES DESTINATIONS GRID
      ========================================= */}
      {activeTab === "cities" && (
        <>
          {cities.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-400">
              No destinations created yet.
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {cities.map((city) => {
                const counts = articleCounts[city.id] || { total: 0, published: 0 };

                return (
                  <div
                    key={city.id}
                    className="rounded-2xl border border-slate-200/90 bg-white overflow-hidden shadow-2xs flex flex-col justify-between hover:shadow-md transition-all"
                  >
                    {/* Hero Image with Country Badge */}
                    <div className="relative aspect-[16/9] w-full overflow-hidden bg-slate-100">
                      {city.heroImage ? (
                        <Image src={city.heroImage} alt={city.name} fill className="object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs font-bold text-slate-400">
                          No Photo
                        </div>
                      )}
                      {city.country && (
                        <span className="absolute left-3 bottom-3 rounded-md bg-black/75 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                          {city.country}
                        </span>
                      )}
                    </div>

                    {/* Card Body */}
                    <div className="p-5 space-y-2 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-base font-bold text-slate-900 leading-tight">
                            {city.name}
                          </h3>
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-mono font-medium text-slate-600 shrink-0">
                            {counts.published} Live / {counts.total} Total
                          </span>
                        </div>

                        <p className="mt-2 text-xs text-slate-500 line-clamp-2 leading-relaxed min-h-[2rem]">
                          {city.intro || "No description set for this destination."}
                        </p>
                      </div>

                      <p className="text-[11px] font-mono text-slate-400 pt-2">
                        URL: {cityPath(city.countrySlug, city.slug)}
                      </p>
                    </div>

                    {/* Card Footer Actions */}
                    <div className="border-t border-slate-100 px-5 py-3 flex items-center justify-between">
                      <Link
                        href={cityPath(city.countrySlug, city.slug)}
                        target="_blank"
                        className="text-xs font-semibold text-slate-600 hover:text-[#DC2626] transition-colors"
                      >
                        View Live ↗
                      </Link>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => openEditModal(city)}
                          className="text-xs font-semibold text-slate-700 hover:text-slate-900 transition-colors cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleDeleteCity(city.id, city.name)}
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
        </>
      )}

      {/* =========================================
          TAB 2: COUNTRY HUBS GRID
      ========================================= */}
      {activeTab === "countries" && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {distinctCountryList.map((countryItem) => {
            const countryObj = countryItem.countryObj || countriesBySlug.get(countryItem.slug);

            return (
              <div
                key={countryItem.slug}
                className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs flex flex-col justify-between hover:shadow-md transition-all space-y-4"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#DC2626]">
                      COUNTRY BUREAU
                    </span>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                      {countryItem.cityCount} {countryItem.cityCount === 1 ? "City" : "Cities"}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 mt-1">
                    {countryItem.name}
                  </h3>

                  <p className="mt-2 text-xs text-slate-600 line-clamp-3 leading-relaxed">
                    {countryObj?.intro || "No custom country description added yet. Add a summary to showcase on the country hub page."}
                  </p>

                  <p className="text-[11px] font-mono text-slate-400 mt-3">
                    URL: {countryPath(countryItem.slug)}
                  </p>
                </div>

                <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
                  <Link
                    href={countryPath(countryItem.slug)}
                    target="_blank"
                    className="text-xs font-semibold text-slate-600 hover:text-[#DC2626] transition-colors"
                  >
                    View Hub ↗
                  </Link>
                  <button
                    type="button"
                    onClick={() => openEditCountryModal(countryItem)}
                    className="rounded-lg bg-slate-100 hover:bg-slate-200 px-3 py-1.5 text-xs font-bold text-slate-800 transition-colors cursor-pointer"
                  >
                    Edit Summary
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* =========================================
          MODAL: ADD / EDIT CITY (+ COUNTRY SECTION)
      ========================================= */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={closeModal} />
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#DC2626]">
                  {editingId ? "EDIT DESTINATION" : "NEW DESTINATION"}
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                  {editingId ? `Edit Destination: ${form.name}` : "Create Destination Bureau"}
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

            <div className="space-y-4">
              {/* City Autocomplete */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Destination City *
                </label>
                <CityAutocomplete
                  initialQuery={editingId && form.name ? `${form.name}, ${form.country}` : ""}
                  placeholder="Search for any world city, e.g. Paris, Kochi, Tokyo"
                  onSelect={handleCitySelect}
                />
                <p className="mt-1 text-[10px] text-slate-500">
                  Search and select any world city. City overview and Country summary will be auto-filled and remain editable.
                </p>
              </div>

              {/* Readonly City & Country fields */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                    City Name *
                  </label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-800 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Country *
                  </label>
                  <input
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-800 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  City URL Slug *
                </label>
                <input
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") })}
                  placeholder="e.g. paris"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-mono text-slate-900 focus:border-[#DC2626] focus:outline-none"
                />
                <p className="mt-1 text-[10px] text-slate-400">
                  Public URL: /{form.country ? slugifyCountry(form.country) : "country"}/{form.slug || "slug"}
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  City Overview Summary (Auto-generated &amp; Editable)
                </label>
                <textarea
                  value={form.intro}
                  onChange={(e) => setForm({ ...form, intro: e.target.value })}
                  rows={3}
                  placeholder={`Brief summary of coverage and key attractions in ${form.name || "this city"}...`}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-[#DC2626] focus:outline-none resize-none leading-relaxed"
                />
              </div>

              <ImageUploadField
                label="City Cover Image"
                value={form.heroImage}
                onChange={(url) => setForm({ ...form, heroImage: url })}
                uploadUrl="/api/admin/upload"
              />

              {/* ============================================================
                  COUNTRY INFO — read-only pointer, not editable here.
                  Country overview/meta data has exactly one writer: the
                  Country Hubs tab's own "Edit Country Hub" modal. This
                  destination form only ever reads that data (via
                  existingCountryInfo below) to show a status note; it never
                  writes it, so a destination can't duplicate or clobber its
                  country's description.
              ============================================================ */}
              {form.country && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🌍</span>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">
                        {form.country} country overview
                      </h4>
                      <p className="text-[10px] text-slate-500">
                        {existingCountryInfo?.intro
                          ? "Already set — managed from Country Hubs, shared by every city in this country."
                          : "Not set yet — this destination will still be created fine; add a country overview anytime from Country Hubs."}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      closeModal();
                      openEditCountryModal({
                        name: form.country,
                        slug: selectedCountrySlug,
                        countryObj: existingCountryInfo,
                      });
                    }}
                    className="shrink-0 text-xs font-bold text-[#DC2626] hover:underline cursor-pointer"
                  >
                    {existingCountryInfo?.intro ? "Edit" : "Add"} in Country Hubs →
                  </button>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                    City Meta Title (SEO)
                  </label>
                  <input
                    value={form.metaTitle}
                    onChange={(e) => setForm({ ...form, metaTitle: e.target.value })}
                    placeholder="Custom SEO Title"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-[#DC2626] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Sort Order
                  </label>
                  <input
                    type="number"
                    value={form.sortOrder}
                    onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-mono text-slate-900 focus:border-[#DC2626] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  City Meta Description (SEO)
                </label>
                <input
                  value={form.metaDescription}
                  onChange={(e) => setForm({ ...form, metaDescription: e.target.value })}
                  placeholder={`Discover the latest attraction news and destination dispatches from ${form.name || "this city"}.`}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-[#DC2626] focus:outline-none"
                />
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
                onClick={handleSaveCity}
                className="rounded-lg bg-[#DC2626] px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-2xs hover:bg-[#B91C1C] transition-all disabled:opacity-60 cursor-pointer"
              >
                {busy ? "Saving..." : editingId ? "Save Changes" : "Create Destination"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================
          MODAL: EDIT COUNTRY HUB DIRECTLY
      ========================================= */}
      {countryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={closeCountryModal} />
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#DC2626]">
                  EDIT COUNTRY HUB
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                  {editingCountry.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeCountryModal}
                className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Country Name
                </label>
                <input
                  value={editingCountry.name}
                  onChange={(e) => setEditingCountry({ ...editingCountry, name: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-[#DC2626] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Country Hub Overview / Summary
                </label>
                <textarea
                  value={editingCountry.intro}
                  onChange={(e) => setEditingCountry({ ...editingCountry, intro: e.target.value })}
                  rows={4}
                  placeholder={`Overview and summary of destination coverage across ${editingCountry.name}...`}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-[#DC2626] focus:outline-none resize-none leading-relaxed"
                />
                <p className="mt-1 text-[10px] text-slate-500">
                  This summary is displayed at the top of the /{editingCountry.slug} page.
                </p>
              </div>

              <ImageUploadField
                label="Country Cover Image (Optional)"
                value={editingCountry.heroImage}
                onChange={(url) => setEditingCountry({ ...editingCountry, heroImage: url })}
                uploadUrl="/api/admin/upload"
              />

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  SEO Meta Title
                </label>
                <input
                  value={editingCountry.metaTitle}
                  onChange={(e) => setEditingCountry({ ...editingCountry, metaTitle: e.target.value })}
                  placeholder={`${editingCountry.name} Destinations — Attraction News & Travel Updates`}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-[#DC2626] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  SEO Meta Description
                </label>
                <input
                  value={editingCountry.metaDescription}
                  onChange={(e) => setEditingCountry({ ...editingCountry, metaDescription: e.target.value })}
                  placeholder={`Explore the top destinations, theme parks, and attractions in ${editingCountry.name}.`}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-[#DC2626] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={closeCountryModal}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleSaveCountry}
                className="rounded-lg bg-[#DC2626] px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-2xs hover:bg-[#B91C1C] transition-all disabled:opacity-60 cursor-pointer"
              >
                {busy ? "Saving..." : "Save Country Summary"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
