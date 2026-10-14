// Icons for the coverage categories, taken from the redesign. Keyed by the
// category slug; any other category gets a plain tag icon.

const ICONS: Record<string, React.ReactNode> = {
  aviation: <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />,
  airports: <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v20M8 6h8M6 10h12M9 14h6M8 22h8M10 2h4" />,
  "travel-rules": (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
    />
  ),
  destinations: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 21V11M12 11c-2-3-5-4-8-3 1 3 3 5 8 3zm0 0c2-3 5-4 8-3-1 3-3 5-8 3zm0 0c0-4-2-7-5-8 1 3 2 6 5 8zm0 0c0-4 2-7 5-8-1 3-2 6-5 8z"
    />
  ),
  attractions: (
    <>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
      />
      <circle cx="12" cy="13" r="3" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  "travel-tips": (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
    />
  ),
  cruises: (
    <>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 18l1.5-6h13L20 18H4z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12V7h4v5M14 12V5h4v7" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2 20c1.5 0 2.5-.5 4-.5s2.5.5 4 .5 2.5-.5 4-.5 2.5.5 4 .5 2.5-.5 4-.5" />
    </>
  ),
};

const TAG = (
  <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
);

// Soft colour behind each icon in the home page's category pills.
const TINTS: Record<string, string> = {
  aviation: "bg-sky-50 text-sky-600",
  airports: "bg-cyan-50 text-cyan-700",
  "travel-rules": "bg-amber-50 text-amber-700",
  destinations: "bg-emerald-50 text-emerald-600",
  attractions: "bg-rose-50 text-rose-600",
  "travel-tips": "bg-indigo-50 text-indigo-600",
  cruises: "bg-purple-50 text-purple-600",
};

export function categoryTint(slug: string): string {
  return TINTS[slug] || "bg-ink-50 text-ink-600";
}

export default function CategoryIcon({ slug, className = "h-5 w-5" }: { slug: string; className?: string }) {
  return (
    <svg className={`${className} fill-none stroke-current`} viewBox="0 0 24 24" strokeWidth="2" aria-hidden="true">
      {ICONS[slug] || TAG}
    </svg>
  );
}
