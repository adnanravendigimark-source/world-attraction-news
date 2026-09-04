"use client";

import { useEffect, useRef, useState } from "react";

export interface CitySelection {
  city: string;
  country: string;
  countryCode: string;
  admin1?: string;
}

// Shared by Admin's "Add Destination" form (components/admin/CitiesManager.tsx)
// and the Contributor article editor's "Other" destination field
// (components/dashboard/ArticleEditor.tsx) — same city/country search
// behavior in both places, backed by the same /api/geo/cities endpoint, so
// there's exactly one autocomplete implementation to maintain instead of
// two that could quietly drift apart.
//
// Debounced client-side (250ms) on top of the API route's own 2-character
// minimum — between the two, a fast typist never fires more than one
// request per short pause, not one per keystroke.
export default function CityAutocomplete({
  initialQuery = "",
  placeholder = "Search for a city...",
  onSelect,
  className = "",
  inputClassName = "",
}: {
  initialQuery?: string;
  placeholder?: string;
  onSelect: (selection: CitySelection) => void;
  className?: string;
  inputClassName?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<CitySelection[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geo/cities?q=${encodeURIComponent(q)}`);
        const data = await res.json().catch(() => ({}));
        setResults(res.ok ? data.results || [] : []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  function handleSelect(r: CitySelection) {
    const label = r.admin1 ? `${r.city} (${r.admin1}), ${r.country}` : `${r.city}, ${r.country}`;
    setQuery(label);
    setOpen(false);
    setResults([]);
    onSelect(r);
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (results.length) setOpen(true);
        }}
        placeholder={placeholder}
        autoComplete="off"
        className={
          inputClassName ||
          "w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-[#DC2626] focus:outline-none"
        }
      />
      {open && query.trim().length >= 2 && (
        <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {loading ? (
            <p className="px-3 py-2 text-xs text-slate-400">Searching global cities…</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 text-xs text-slate-400">No matching cities found.</p>
          ) : (
            results.map((r, i) => (
              <button
                key={`${r.city}-${r.country}-${r.admin1 || ""}-${i}`}
                type="button"
                onClick={() => handleSelect(r)}
                className="block w-full px-3 py-2 text-left text-xs text-slate-800 hover:bg-slate-50 cursor-pointer"
              >
                <span className="font-semibold">{r.city}</span>
                {r.admin1 && <span className="text-slate-500 font-normal"> ({r.admin1})</span>}
                <span className="text-slate-400">, {r.country}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
