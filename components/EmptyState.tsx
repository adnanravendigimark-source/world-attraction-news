import Link from "next/link";

export default function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
}: {
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-ink-200 bg-white py-14 text-center">
      <p className="font-serif text-base font-bold text-ink-800">{title}</p>
      {description && <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-500">{description}</p>}
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-signal px-4 py-2 text-xs font-semibold text-white hover:bg-signal-dark"
        >
          {actionLabel} →
        </Link>
      )}
    </div>
  );
}
