"use client";

import { useState } from "react";
import { Check, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LockedBlock } from "@/lib/drafting/editable";
import { cn } from "@/lib/utils";

const cellClass = "h-9 w-full min-w-0 rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10";

/**
 * Inline editor for the structured parts of a draft: tables, the boundary
 * schedule and signature blocks. Changes apply to this draft version only;
 * the matter details are not changed.
 */
export function LockedEditor({ block, hindi, onSave, onCancel }: { block: LockedBlock; hindi: boolean; onSave: (block: LockedBlock) => void; onCancel: () => void }) {
  const [value, setValue] = useState<LockedBlock>(block);
  const font = hindi ? "font-devanagari" : "";
  let body: React.ReactNode = null;

  if (value.t === "table" || value.t === "boundaries") {
    const head = value.head;
    const rows = value.rows as string[][];
    const columns = Math.max(head?.length ?? 0, ...rows.map((row) => row.length), 1);
    const setCell = (row: number, column: number, text: string) => setValue({ ...value, rows: rows.map((cells, index) => (index === row ? Object.assign([...cells], { [column]: text }) : cells)) } as LockedBlock);
    const setHead = (column: number, text: string) => setValue({ ...value, head: Object.assign([...(head ?? [])], { [column]: text }) } as LockedBlock);
    const addRow = () => setValue({ ...value, rows: [...rows, Array.from({ length: columns }, () => "")] } as LockedBlock);
    const removeRow = (row: number) => setValue({ ...value, rows: rows.filter((_, index) => index !== row) } as LockedBlock);
    body = <div className="overflow-x-auto">
      <table className="w-full min-w-[28rem] border-separate border-spacing-1 text-sm">
        {head ? <thead><tr>{head.map((cell, column) => <th key={column} className="font-normal"><input aria-label={"Column " + (column + 1) + " heading"} className={cn(cellClass, "bg-secondary/60 font-semibold", font)} value={cell} onChange={(event) => setHead(column, event.target.value)} /></th>)}<th className="w-8" /></tr></thead> : null}
        <tbody>{rows.map((cells, row) => <tr key={row}>
          {Array.from({ length: columns }, (_, column) => <td key={column}><input aria-label={"Row " + (row + 1) + ", column " + (column + 1)} className={cn(cellClass, font)} value={cells[column] ?? ""} onChange={(event) => setCell(row, column, event.target.value)} /></td>)}
          <td className="w-8">{value.t === "table" ? <button type="button" aria-label={"Remove row " + (row + 1)} title="Remove row" onClick={() => removeRow(row)} className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="size-3.5" /></button> : null}</td>
        </tr>)}</tbody>
      </table>
      {value.t === "table" && rows.length < 200 ? <button type="button" onClick={addRow} className="mt-1 flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-secondary"><Plus className="size-3.5" /> Add row</button> : null}
    </div>;
  } else if (value.t === "signatures") {
    const items = value.items;
    const setItem = (index: number, next: { label: string; lines: string[] }) => setValue({ ...value, items: items.map((item, position) => (position === index ? next : item)) });
    body = <div className="grid gap-3 sm:grid-cols-[repeat(2,minmax(0,1fr))]">
      {items.map((item, index) => <div key={index} className="space-y-1.5 rounded-lg border border-border bg-background p-2.5">
        <div className="flex items-center gap-1">
          <input aria-label={"Signatory " + (index + 1) + " label"} className={cn(cellClass, "font-semibold", font)} value={item.label} onChange={(event) => setItem(index, { ...item, label: event.target.value })} />
          <button type="button" aria-label={"Remove signatory " + (index + 1)} title="Remove" onClick={() => setValue({ ...value, items: items.filter((_, position) => position !== index) })} className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="size-3.5" /></button>
        </div>
        <textarea aria-label={"Signatory " + (index + 1) + " details, one per line"} rows={Math.max(2, item.lines.length)} className={cn("w-full resize-y rounded-md border border-border bg-background px-2 py-1.5 text-sm leading-6 outline-none focus:border-primary", font)} value={item.lines.join("\n")} onChange={(event) => setItem(index, { ...item, lines: event.target.value.split("\n").slice(0, 12) })} />
      </div>)}
      {items.length < 40 ? <button type="button" onClick={() => setValue({ ...value, items: [...items, { label: hindi ? "साक्षी" : "Witness", lines: [] }] })} className="flex min-h-20 items-center justify-center gap-1 rounded-lg border border-dashed border-border text-xs font-medium text-primary hover:bg-secondary"><Plus className="size-3.5" /> Add signatory</button> : null}
    </div>;
  }

  return <div className="appear min-w-0 rounded-lg border border-primary/30 bg-primary/[.03] p-3 font-sans" onKeyDown={(event) => { if (event.key === "Escape") onCancel(); }}>
    <p className="mb-2 text-xs text-muted-foreground">{value.t === "signatures" ? "Signature blocks: the first box is the heading, details go one per line." : "Edit any cell."} Changes apply to this draft only; the deed details stay as they are.</p>
    {body}
    <div className="mt-3 flex justify-end gap-2">
      <Button type="button" variant="ghost" className="h-8" onClick={onCancel}><X className="size-4" /> Cancel</Button>
      <Button type="button" className="h-8" onClick={() => onSave(value)}><Check className="size-4" /> Done</Button>
    </div>
  </div>;
}
