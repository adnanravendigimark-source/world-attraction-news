import Link from "next/link";

export default function Breadcrumbs({ items }: { items: { name: string; path: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-xs text-ink-500">
      {items.map((item, i) => (
        <span key={item.path} className="flex items-center gap-1.5">
          {i > 0 && <span aria-hidden="true">/</span>}
          {i === items.length - 1 ? (
            <span className="font-medium text-ink-700">{item.name}</span>
          ) : (
            <Link href={item.path} className="hover:text-signal">
              {item.name}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
