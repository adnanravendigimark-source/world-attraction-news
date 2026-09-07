"use client";

import { useMemo, useState } from "react";
import { useToast } from "@/components/ToastProvider";

interface PickerItem {
  slug: string;
  label: string;
}

// Shared UI for both "Top Destinations" and "Top Categories" below — same
// pick-and-reorder pattern, just pointed at a different item list and a
// different save endpoint. Keeping this as one generic component instead of
// writing the reorder/add/remove logic twice for cities vs categories.
function FeaturedPicker({
  title,
  description,
  emptyDropdownHint,
  addPlaceholder,
  allItems,
  selectedSlugs,
  onChangeSelected,
  onSave,
  saving,
  dirty,
}: {
  title: string;
  description: string;
  emptyDropdownHint: string;
  addPlaceholder: string;
  allItems: PickerItem[];
  selectedSlugs: string[];
  onChangeSelected: (next: string[]) => void;
  onSave: () => void;
  saving: boolean;
  dirty: boolean;
}) {
  const [toAdd, setToAdd] = useState("");
  const bySlug = useMemo(() => new Map(allItems.map((i) => [i.slug, i])), [allItems]);
  const unselected = useMemo(
    () => allItems.filter((i) => !selectedSlugs.includes(i.slug)),
    [allItems, selectedSlugs]
  );

  function add(slug: string) {
    if (!slug || selectedSlugs.includes(slug)) return;
    onChangeSelected([...selectedSlugs, slug]);
    setToAdd("");
  }

  function remove(slug: string) {
    onChangeSelected(selectedSlugs.filter((s) => s !== slug));
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= selectedSlugs.length) return;
    const next = [...selectedSlugs];
    [next[index], next[target]] = [next[target], next[index]];
    onChangeSelected(next);
  }

  return (
    <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-4">
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
          {title} ({selectedSlugs.length})
        </h2>
        <p className="mt-0.5 text-[11px] text-slate-500">{description}</p>
      </div>

      {selectedSlugs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-xs text-slate-400">
          Nothing selected yet.
        </div>
      ) : (
        <ul className="space-y-2">
          {selectedSlugs.map((slug, index) => {
            const item = bySlug.get(slug);
            return (
              <li
                key={slug}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5"
              >
                <span className="text-xs font-semibold text-slate-800">
                  {item ? item.label : `${slug} (deleted)`}
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                    aria-label="Move up"
                    className="h-7 w-7 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    disabled={index === selectedSlugs.length - 1}
                    onClick={() => move(index, 1)}
                    aria-label="Move down"
                    className="h-7 w-7 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  >
                    ▼
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(slug)}
                    aria-label={`Remove ${item?.label || slug}`}
                    className="h-7 w-7 rounded-lg border border-rose-200 text-rose-500 hover:bg-rose-50 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {unselected.length === 0 ? (
        <p className="text-xs text-slate-400">
          {allItems.length === 0 ? emptyDropdownHint : "Everything is already selected."}
        </p>
      ) : (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <select
            value={toAdd}
            onChange={(e) => setToAdd(e.target.value)}
            className="flex-1 min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-[#DC2626] focus:outline-none"
          >
            <option value="">{addPlaceholder}</option>
            {unselected.map((i) => (
              <option key={i.slug} value={i.slug}>
                {i.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!toAdd}
            onClick={() => add(toAdd)}
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            Add
          </button>
        </div>
      )}

      <div className="flex justify-end pt-1 border-t border-slate-100">
        <button
          type="button"
          disabled={!dirty || saving}
          onClick={onSave}
          className="mt-3 rounded-lg bg-[#DC2626] px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-2xs hover:bg-[#B91C1C] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {saving ? "Saving..." : `Save ${title}`}
        </button>
      </div>
    </section>
  );
}

export default function HeaderManager({
  allCities,
  allCategories,
  initialFeaturedCitySlugs,
  initialFeaturedCategorySlugs,
}: {
  allCities: PickerItem[];
  allCategories: PickerItem[];
  initialFeaturedCitySlugs: string[];
  initialFeaturedCategorySlugs: string[];
}) {
  const toast = useToast();

  const [destSlugs, setDestSlugs] = useState(initialFeaturedCitySlugs);
  const [savedDestSlugs, setSavedDestSlugs] = useState(initialFeaturedCitySlugs);
  const [savingDest, setSavingDest] = useState(false);

  const [catSlugs, setCatSlugs] = useState(initialFeaturedCategorySlugs);
  const [savedCatSlugs, setSavedCatSlugs] = useState(initialFeaturedCategorySlugs);
  const [savingCat, setSavingCat] = useState(false);

  async function saveDestinations() {
    setSavingDest(true);
    try {
      const res = await fetch("/api/admin/featured-destinations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slugs: destSlugs }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save Top Destinations.");
      setDestSlugs(data.slugs);
      setSavedDestSlugs(data.slugs);
      toast.success("Top Destinations updated — the public navbar now reflects this.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save Top Destinations.");
    } finally {
      setSavingDest(false);
    }
  }

  async function saveCategories() {
    setSavingCat(true);
    try {
      const res = await fetch("/api/admin/featured-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slugs: catSlugs }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save Top Categories.");
      setCatSlugs(data.slugs);
      setSavedCatSlugs(data.slugs);
      toast.success("Top Categories updated — the public navbar now reflects this.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save Top Categories.");
    } finally {
      setSavingCat(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs text-slate-600 leading-relaxed">
          Choose which destinations and categories appear in the public navbar&apos;s dropdowns, and
          in what order. Nothing here is hardcoded — the navbar always shows exactly this.
        </p>
      </div>

      <FeaturedPicker
        title="Top Destinations"
        description="Shown in the navbar's Destinations dropdown. Falls back to the first 6 destinations by sort order until you pick some."
        emptyDropdownHint="No destinations exist yet — add one from Admin -> Destinations first."
        addPlaceholder="Choose a destination…"
        allItems={allCities}
        selectedSlugs={destSlugs}
        onChangeSelected={setDestSlugs}
        onSave={saveDestinations}
        saving={savingDest}
        dirty={JSON.stringify(destSlugs) !== JSON.stringify(savedDestSlugs)}
      />

      <FeaturedPicker
        title="Top Categories"
        description="Shown in the navbar's Categories dropdown. Falls back to the first 6 categories by sort order until you pick some."
        emptyDropdownHint="No categories exist yet — add one from Admin -> Categories first."
        addPlaceholder="Choose a category…"
        allItems={allCategories}
        selectedSlugs={catSlugs}
        onChangeSelected={setCatSlugs}
        onSave={saveCategories}
        saving={savingCat}
        dirty={JSON.stringify(catSlugs) !== JSON.stringify(savedCatSlugs)}
      />
    </div>
  );
}
