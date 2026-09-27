"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { getCoreRowModel, getSortedRowModel, useReactTable, type ColumnDef, type SortingState } from "@tanstack/react-table";
import { ArrowUpDown, Copy, ExternalLink, Search, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

import { deleteDeed, duplicateDeed } from "@/app/actions/deeds";
import { StatusBadge, TypeBadge } from "@/components/deeds/badges";
import { deedTypeLabels, statusLabels, type DeedStatus, type DeedType } from "@/lib/deeds";
import type { Deed } from "@/types/database";

type Props = { deeds: Deed[]; initialQuery?: string; initialStatus?: string };
const selectClass = "h-9 rounded-lg border border-border bg-background px-2 text-sm outline-none focus:border-primary";

export function DeedsTable({ deeds, initialQuery = "", initialStatus }: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [type, setType] = useState<DeedType | "all">("all");
  const [status, setStatus] = useState<DeedStatus | "all">(initialStatus && initialStatus in statusLabels ? (initialStatus as DeedStatus) : "all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sorting, setSorting] = useState<SortingState>([{ id: "updated_at", desc: true }]);
  const [page, setPage] = useState(0);
  const [deleting, setDeleting] = useState<Deed | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => deeds.filter((deed) => {
    const needle = query.toLowerCase();
    const matchesQuery = !needle || deed.title.toLowerCase().includes(needle) || deed.reference_no.toLowerCase().includes(needle);
    const matchesType = type === "all" || deed.deed_type === type;
    const matchesStatus = status === "all" || deed.status === status;
    const date = deed.created_at.slice(0, 10);
    return matchesQuery && matchesType && matchesStatus && (!from || date >= from) && (!to || date <= to);
  }), [deeds, from, query, status, to, type]);

  const duplicate = (deed: Deed) =>
    startTransition(() => void duplicateDeed({ id: deed.id }).then((result) => {
      if (result.error) toast.error(result.error); else toast.success("Deed duplicated.");
    }));

  const columns = useMemo<ColumnDef<Deed>[]>(() => [
    { accessorKey: "reference_no", header: "Reference", cell: ({ row }) => <span className="font-mono text-xs font-semibold text-primary">{row.original.reference_no}</span> },
    { accessorKey: "title", header: "Title", cell: ({ row }) => <Link className="font-medium text-foreground hover:text-primary hover:underline" href={"/app/deeds/" + row.original.id}>{row.original.title}</Link> },
    { accessorKey: "deed_type", header: "Type", cell: ({ row }) => <TypeBadge type={row.original.deed_type} /> },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    { accessorKey: "updated_at", header: "Updated", cell: ({ row }) => <span className="text-muted-foreground">{format(new Date(row.original.updated_at), "d MMM yyyy")}</span> },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Link aria-label={"Open " + row.original.title} className="rounded-md p-2 text-primary hover:bg-secondary" href={"/app/deeds/" + row.original.id}><ExternalLink className="size-4" /></Link>
          <button aria-label={"Duplicate " + row.original.title} className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-primary" onClick={() => duplicate(row.original)}><Copy className="size-4" /></button>
          <button aria-label={"Delete " + row.original.title} className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={() => { setDeleting(row.original); setConfirmation(""); }}><Trash2 className="size-4" /></button>
        </div>
      ),
    },
  ], []);

  const table = useReactTable({ data: filtered, columns, state: { sorting }, onSortingChange: setSorting, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel() });
  const rows = table.getRowModel().rows;
  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const paged = rows.slice(page * pageSize, page * pageSize + pageSize);

  const changeFilters = () => setPage(0);
  const hasFilters = Boolean(query || type !== "all" || status !== "all" || from || to);
  const clearFilters = () => {
    setQuery("");
    setType("all");
    setStatus("all");
    setFrom("");
    setTo("");
    setPage(0);
  };
  const performDelete = () => {
    if (!deleting) return;
    startTransition(() => void deleteDeed({ id: deleting.id, referenceNo: confirmation }).then((result) => {
      if (result.error) return toast.error(result.error);
      toast.success("Deed deleted.");
      setDeleting(null);
    }));
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-[minmax(220px,1fr)_150px_170px_150px_150px_auto]">
        <label className="relative col-span-2 lg:col-span-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary" onChange={(event) => { setQuery(event.target.value); changeFilters(); }} placeholder="Search title or reference…" value={query} /></label>
        <select className={selectClass} onChange={(event) => { setType(event.target.value as DeedType | "all"); changeFilters(); }} value={type}><option value="all">All types</option>{Object.entries(deedTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <select className={selectClass} onChange={(event) => { setStatus(event.target.value as DeedStatus | "all"); changeFilters(); }} value={status}><option value="all">All statuses</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <input aria-label="From date" className={selectClass} onChange={(event) => { setFrom(event.target.value); changeFilters(); }} type="date" value={from} />
        <input aria-label="To date" className={selectClass} onChange={(event) => { setTo(event.target.value); changeFilters(); }} type="date" value={to} />
        {hasFilters ? <button className="col-span-2 h-9 rounded-lg px-3 text-sm font-semibold text-primary hover:bg-secondary lg:col-span-1" onClick={clearFilters} type="button">Clear</button> : null}
      </div>
      <div className="overflow-hidden rounded-xl border border-border">
        <ul className="divide-y divide-border md:hidden">
          {paged.length ? paged.map(({ original: deed }) => (
            <li className="flex items-start gap-2 p-3" key={deed.id}>
              <Link className="min-w-0 flex-1" href={"/app/deeds/" + deed.id}>
                <p className="font-mono text-xs font-semibold text-muted-foreground">{deed.reference_no}</p>
                <p className="mt-0.5 font-semibold leading-5 text-primary">{deed.title}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5"><TypeBadge type={deed.deed_type} /><StatusBadge status={deed.status} /><span className="text-xs text-muted-foreground">{format(new Date(deed.updated_at), "d MMM yyyy")}</span></div>
              </Link>
              <div className="flex shrink-0 flex-col">
                <button aria-label={"Duplicate " + deed.title} className="rounded-md p-2 text-muted-foreground hover:bg-secondary" disabled={pending} onClick={() => duplicate(deed)}><Copy className="size-4" /></button>
                <button aria-label={"Delete " + deed.title} className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={() => { setDeleting(deed); setConfirmation(""); }}><Trash2 className="size-4" /></button>
              </div>
            </li>
          )) : <li className="px-4 py-12 text-center text-sm text-muted-foreground">No deeds match these filters.</li>}
        </ul>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-secondary/50 text-xs uppercase tracking-wide text-muted-foreground">
              {table.getHeaderGroups().map((group) => <tr key={group.id}>{group.headers.map((header) => <th className="px-5 py-3 font-semibold" key={header.id}>{header.isPlaceholder ? null : header.column.getCanSort() ? <button className="inline-flex items-center gap-1" onClick={header.column.getToggleSortingHandler()}>{String(header.column.columnDef.header)} <ArrowUpDown className="size-3" /></button> : header.column.columnDef.header as string}</th>)}</tr>)}
            </thead>
            <tbody className="divide-y divide-border">
              {paged.length ? paged.map((row) => <tr className="hover:bg-secondary/40" key={row.id}>{row.getVisibleCells().map((cell) => <td className="px-5 py-3" key={cell.id}>{typeof cell.column.columnDef.cell === "function" ? cell.column.columnDef.cell(cell.getContext()) : cell.getValue() as string}</td>)}</tr>) : <tr><td className="px-5 py-14 text-center text-muted-foreground" colSpan={6}>No deeds match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-3 text-sm sm:px-5">
          <span className="text-muted-foreground">{filtered.length} deed{filtered.length === 1 ? "" : "s"}</span>
          <div className="flex items-center gap-3"><button className="font-medium text-primary disabled:text-muted-foreground" disabled={page === 0} onClick={() => setPage((current) => current - 1)}>Previous</button><span className="text-muted-foreground">Page {page + 1} of {pageCount}</span><button className="font-medium text-primary disabled:text-muted-foreground" disabled={page + 1 >= pageCount} onClick={() => setPage((current) => current + 1)}>Next</button></div>
        </div>
      </div>
      {deleting ? (
        <div className="fixed inset-0 z-50 grid place-items-end bg-primary/40 sm:place-items-center sm:p-4">
          <div className="w-full rounded-t-2xl bg-card p-5 shadow-2xl sm:max-w-md sm:rounded-xl sm:p-6">
            <h2 className="text-lg font-semibold text-primary">Delete this deed?</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">This permanently removes <strong>{deleting.title}</strong> and all documents stored under it. Type <span className="font-mono font-semibold text-primary">{deleting.reference_no}</span> to confirm.</p>
            <input className="mt-5 h-10 w-full rounded-lg border border-border bg-background px-3 font-mono text-sm outline-none focus:border-destructive" onChange={(event) => setConfirmation(event.target.value)} value={confirmation} />
            <div className="mt-5 flex justify-end gap-3"><button className="text-sm font-semibold text-muted-foreground" onClick={() => setDeleting(null)}>Cancel</button><button className="rounded-lg bg-destructive px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={pending || confirmation !== deleting.reference_no} onClick={performDelete}>Delete deed</button></div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
