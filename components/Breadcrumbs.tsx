import Link from "next/link";

export default function Breadcrumbs({ items }: { items: { name: string; path: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs text-ink-500">
      {items.map((item, i) => (
        <span key={item.path + i} className="flex items-center gap-2">
          {i > 0 && <span className="text-ink-300" aria-hidden="true">/</span>}
          {i === items.length - 1 ? (
            <span className="font-semibold text-ink-900 truncate max-w-xs sm:max-w-md">{item.name}</span>
          ) : (
            <Link href={item.path} className="font-medium text-ink-600 transition-colors hover:text-signal">
              {item.name}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
