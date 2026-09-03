interface StatusBadgeProps {
  status: string;
  size?: "sm" | "md";
}

const STYLES: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  draft: {
    bg: "bg-slate-100",
    text: "text-slate-700",
    border: "border-slate-200",
    dot: "bg-slate-400",
  },
  pending: {
    bg: "bg-amber-50/80",
    text: "text-amber-800",
    border: "border-amber-200/80",
    dot: "bg-amber-500",
  },
  under_review: {
    bg: "bg-blue-50/80",
    text: "text-blue-800",
    border: "border-blue-200/80",
    dot: "bg-blue-500",
  },
  changes_requested: {
    bg: "bg-orange-50/90",
    text: "text-orange-900",
    border: "border-orange-200",
    dot: "bg-orange-500",
  },
  approved: {
    bg: "bg-emerald-50/90",
    text: "text-emerald-800",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
  },
  scheduled: {
    bg: "bg-purple-50/90",
    text: "text-purple-800",
    border: "border-purple-200",
    dot: "bg-purple-500",
  },
  rejected: {
    bg: "bg-rose-50/90",
    text: "text-rose-800",
    border: "border-rose-200",
    dot: "bg-rose-500",
  },
  published: {
    bg: "bg-emerald-50",
    text: "text-emerald-800",
    border: "border-emerald-200/80",
    dot: "bg-emerald-500",
  },
  unpublished: {
    bg: "bg-slate-100",
    text: "text-slate-600",
    border: "border-slate-200",
    dot: "bg-slate-400",
  },
  suspended: {
    bg: "bg-rose-50",
    text: "text-rose-800",
    border: "border-rose-200",
    dot: "bg-rose-500",
  },
};

const LABELS: Record<string, string> = {
  under_review: "Under Review",
  changes_requested: "Changes Requested",
  draft: "Draft",
  pending: "Pending",
  approved: "Approved",
  scheduled: "Scheduled",
  rejected: "Rejected",
  published: "Published",
  unpublished: "Unpublished",
  suspended: "Suspended",
};

export default function StatusBadge({ status, size = "sm" }: StatusBadgeProps) {
  const cfg = STYLES[status] || {
    bg: "bg-slate-100",
    text: "text-slate-700",
    border: "border-slate-200",
    dot: "bg-slate-400",
  };
  const label = LABELS[status] || status;

  return (
    <span
      className={`inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap rounded-full border font-semibold tracking-wide ${
        size === "sm" ? "px-2.5 py-0.5 text-[11px]" : "px-3 py-1 text-xs"
      } ${cfg.bg} ${cfg.text} ${cfg.border}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} aria-hidden="true" />
      <span>{label}</span>
      {(status === "published" || status === "approved") && (
        <span className="font-bold ml-0.5 opacity-80">✓</span>
      )}
    </span>
  );
}
