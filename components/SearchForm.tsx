"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SearchForm({
  initialQuery = "",
  autoFocus = false,
  className = "",
  placeholder = "Search articles, cities, categories…",
}: {
  initialQuery?: string;
  autoFocus?: boolean;
  className?: string;
  placeholder?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = value.trim();
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
  }

  return (
    <form onSubmit={handleSubmit} role="search" className={`flex items-center gap-2 ${className}`}>
      <div className="relative flex-1">
        <svg
          viewBox="0 0 24 24"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="7" />
          <path strokeLinecap="round" d="m21 21-4.3-4.3" />
        </svg>
        <input
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          aria-label="Search"
          className="w-full rounded-md border border-ink-200 bg-white py-2 pl-9 pr-3 text-sm text-ink-800 placeholder:text-ink-400 focus:border-signal focus:outline-none"
        />
      </div>
      <button
        type="submit"
        className="shrink-0 rounded-md bg-ink-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-ink-800"
      >
        Search
      </button>
    </form>
  );
}
