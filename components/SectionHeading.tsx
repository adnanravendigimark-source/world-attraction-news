import Link from "next/link";

export default function SectionHeading({
  eyebrow,
  title,
  href,
  hrefLabel = "View all",
}: {
  eyebrow?: string;
  title: string;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b-2 border-ink-900 pb-3">
      <div>
        {eyebrow && (
          <div className="flex items-center gap-2 mb-1">
            <span className="h-1.5 w-1.5 rounded-full bg-signal" aria-hidden="true" />
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-signal">{eyebrow}</p>
          </div>
        )}
        <h2 className="font-serif text-2xl font-black tracking-tight text-ink-900 sm:text-3xl">{title}</h2>
      </div>
      {href && (
        <Link
          href={href}
          className="group inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap text-xs font-bold uppercase tracking-wider text-ink-700 transition-colors hover:text-signal"
        >
          <span>{hrefLabel}</span>
          <span className="transition-transform group-hover:translate-x-1">→</span>
        </Link>
      )}
    </div>
  );
}
