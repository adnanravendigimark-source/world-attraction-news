// Shared score pill — used on both the Contributor Articles list and the
// article detail page (previously each had its own copy of this styling
// with a different, cruder threshold). Mirrors the 3-tier scale already
// established in lib/emailTemplates.ts's approval email (>=7 good, >=4
// middling, below that low) instead of inventing a new one.
export default function ScoreBadge({ score, size = "sm" }: { score: number; size?: "sm" | "md" }) {
  const tier = score >= 7 ? "high" : score >= 4 ? "mid" : "low";
  const cls =
    tier === "high"
      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
      : tier === "mid"
      ? "bg-amber-50 text-amber-800 border-amber-200"
      : "bg-rose-50 text-rose-800 border-rose-200";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border font-mono font-bold ${
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"
      } ${cls}`}
    >
      ★ {score}/10
    </span>
  );
}
