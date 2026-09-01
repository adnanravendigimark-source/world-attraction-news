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
    <div className="flex items-end justify-between gap-4 border-b-2 border-ink-900 pb-2.5">
      <div>
        {eyebrow && (
          <p className="text-[10px] font-bold uppercase tracking-widest text-signal">{eyebrow}</p>
        )}
        <h2 className="font-serif text-xl font-bold text-ink-900 sm:text-2xl">{title}</h2>
      </div>
      {href && (
        <Link
          href={href}
          className="shrink-0 whitespace-nowrap text-xs font-semibold text-ink-600 transition-colors hover:text-signal"
        >
          {hrefLabel} →
        </Link>
      )}
    </div>
  );
}
