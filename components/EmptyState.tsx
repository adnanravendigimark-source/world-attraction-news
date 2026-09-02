import Link from "next/link";

export default function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  icon,
}: {
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-ink-200 bg-white/80 backdrop-blur-sm p-10 sm:p-14 text-center">
      {icon ? (
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-paper-100 text-ink-600">
          {icon}
        </div>
      ) : (
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-paper-100 text-ink-500">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
        </div>
      )}
      <h3 className="font-serif text-lg font-bold text-ink-900">{title}</h3>
      {description && <p className="mx-auto mt-1.5 max-w-md text-sm text-ink-500 leading-relaxed">{description}</p>}
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-ink-900 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-card transition-all hover:bg-signal"
        >
          <span>{actionLabel}</span>
          <span>→</span>
        </Link>
      )}
    </div>
  );
}
