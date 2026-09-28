"use client";

import { useState, useTransition } from "react";
import { LoaderCircle, Pencil, Save, Trash2, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { DeedData } from "@/lib/schemas/deed-data";
import { cn } from "@/lib/utils";

export type SaveSection = <K extends keyof Omit<DeedData, "version">>(section: K, value: DeedData[K]) => Promise<boolean>;

export const cardClass = "rounded-xl border border-border bg-card shadow-sm";

export function SectionHeader({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div>
        <h2 className="font-semibold text-primary">{title}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function Empty({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description: string; action: React.ReactNode }) {
  return (
    <div className="px-6 py-12 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-xl bg-secondary text-accent-foreground">
        <Icon className="size-6" />
      </span>
      <p className="mt-4 font-semibold text-primary">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
      <div className="mt-5">{action}</div>
    </div>
  );
}

export function RowActions({ label, onEdit, onDelete, disabled }: { label: string; onEdit: () => void; onDelete: () => void; disabled?: boolean }) {
  return (
    <div className="flex shrink-0 gap-1">
      <button aria-label={"Edit " + label} className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-primary" disabled={disabled} onClick={onEdit} type="button">
        <Pencil className="size-4" />
      </button>
      <button aria-label={"Remove " + label} className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" disabled={disabled} onClick={onDelete} type="button">
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}

/** Add / edit / remove items of a list section and persist the whole list. */
export function useListEditor<T extends { id: string }>(items: T[], save: (next: T[]) => Promise<boolean>) {
  const [editing, setEditing] = useState<T | "new" | null>(null);
  const [pending, startTransition] = useTransition();

  const upsert = (item: T) =>
    startTransition(async () => {
      const exists = items.some((current) => current.id === item.id);
      const next = exists ? items.map((current) => (current.id === item.id ? item : current)) : items.concat(item);
      if (await save(next)) setEditing(null);
    });

  const remove = (item: T, label: string) => {
    if (!window.confirm("Remove " + label + "?")) return;
    startTransition(async () => {
      await save(items.filter((current) => current.id !== item.id));
    });
  };

  const move = (item: T, direction: -1 | 1) => {
    const index = items.findIndex((current) => current.id === item.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    startTransition(async () => {
      await save(next);
    });
  };

  return { editing, setEditing, pending, upsert, remove, move };
}

export function SubmitFooter({ formId, pending, onCancel, label }: { formId: string; pending: boolean; onCancel: () => void; label: string }) {
  return (
    <>
      <Button className="h-10" onClick={onCancel} type="button" variant="outline">Cancel</Button>
      <Button className="h-10" disabled={pending} form={formId} type="submit">
        {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />} {label}
      </Button>
    </>
  );
}

export function FormGroup({ title, description, children, className }: { title: string; description?: string; children: React.ReactNode; className?: string }) {
  return (
    <fieldset className={cn("grid gap-4 rounded-lg border border-border p-3 sm:grid-cols-2 sm:p-4", className)}>
      <legend className="px-1 text-sm font-semibold text-primary">
        {title}
        {description ? <span className="ml-1 font-normal text-muted-foreground">· {description}</span> : null}
      </legend>
      {children}
    </fieldset>
  );
}

export function CheckboxField({ label, hint, ...props }: React.ComponentProps<"input"> & { label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border px-3 py-2.5 text-sm hover:bg-secondary/50">
      <input className="mt-0.5 size-4 accent-[var(--primary)]" type="checkbox" {...props} />
      <span>
        <span className="font-medium text-primary">{label}</span>
        {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
      </span>
    </label>
  );
}
