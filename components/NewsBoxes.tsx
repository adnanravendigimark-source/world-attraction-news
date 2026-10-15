// The two boxes beside a news story (see lib/news/highlights.ts).

export function KeyUpdatesBox({ items, className = "" }: { items: string[]; className?: string }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="key-updates-heading" className={`rounded-xl border border-rose-100 border-l-[3px] border-l-signal bg-rose-50/70 p-4 sm:p-5 ${className}`}>
      <h2 id="key-updates-heading" className="flex items-center gap-2.5 font-serif text-lg font-bold text-signal">
        <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
        </svg>
        Key Updates
      </h2>
      <ul className="mt-3 space-y-2.5">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2.5 text-[13px] leading-relaxed text-ink-700 sm:text-sm">
            <span className="mt-[5px] flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border-2 border-signal" aria-hidden="true">
              <span className="h-1 w-1 rounded-full bg-signal" />
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function TravelerStepsBox({ items, className = "" }: { items: string[]; className?: string }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="traveler-steps-heading" className={className}>
      <h2 id="traveler-steps-heading" className="font-serif text-xl font-bold text-ink-900">
        What Travelers Should Do
      </h2>
      <ul className="mt-3 space-y-2.5">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2.5 text-[13px] leading-relaxed text-ink-700 sm:text-sm">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-signal text-white" aria-hidden="true">
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
