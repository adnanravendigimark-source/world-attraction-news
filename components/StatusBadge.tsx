const STYLES: Record<string, string> = {
  draft: "bg-ink-100 text-ink-600 border-ink-200",
  pending: "bg-amber-50 text-amber-800 border-amber-200",
  approved: "bg-blue-50 text-blue-800 border-blue-200",
  rejected: "bg-signal-light text-signal border-signal-border",
  published: "bg-emerald-50 text-emerald-800 border-emerald-200",
  suspended: "bg-orange-50 text-orange-800 border-orange-200",
};

// A checkmark on "approved"/"published" makes the already-final state
// visually distinct from a clickable action button next to it (see
// UsersTable / ArticleReviewPanel), per the product requirement to never
// show an already-completed state as if it were still an available action.
const SUFFIX: Record<string, string> = { approved: " ✓", published: " ✓" };

export default function StatusBadge({ status }: { status: string }) {
  const style = STYLES[status] || "bg-ink-100 text-ink-700 border-ink-200";
  return (
    <span className={`inline-block shrink-0 whitespace-nowrap rounded border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${style}`}>
      {status}
      {SUFFIX[status] || ""}
    </span>
  );
}
