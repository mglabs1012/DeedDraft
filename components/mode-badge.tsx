import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";

export type WorkspaceMode = "standard" | "premium";

export function ModeBadge({ mode, className }: { mode: WorkspaceMode; className?: string }) {
  return mode === "premium"
    ? <span className={cn("inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900", className)}><Crown className="size-3" /> Premium</span>
    : <span className={cn("inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-secondary-foreground", className)}>Standard</span>;
}
