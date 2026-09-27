import { cn } from "@/lib/utils";
import { deedTypeLabels, statusLabels, type DeedStatus, type DeedType } from "@/lib/deeds";

const statusStyles: Record<DeedStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  data_collection: "bg-blue-50 text-blue-700",
  under_review: "bg-amber-50 text-amber-700",
  generated: "bg-emerald-50 text-emerald-700",
  finalized: "bg-primary text-primary-foreground",
};

export function StatusBadge({ status }: { status: DeedStatus }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold", statusStyles[status])}>
      {statusLabels[status]}
    </span>
  );
}

export function TypeBadge({ type }: { type: DeedType }) {
  return (
    <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground">
      {deedTypeLabels[type]}
    </span>
  );
}
