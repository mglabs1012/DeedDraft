import { cn } from "@/lib/utils";

export const inputClass =
  "h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60";

export const textareaClass =
  "min-h-24 w-full rounded-lg border border-border bg-background p-3 text-sm leading-6 outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15";

export function Field({
  label,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("block space-y-1.5 text-sm font-medium text-primary", className)}>
      <span>
        {label}
        {hint ? <span className="font-normal text-muted-foreground"> ({hint})</span> : null}
      </span>
      {children}
      {error ? <span className="block text-xs font-normal text-destructive">{error}</span> : null}
    </label>
  );
}
