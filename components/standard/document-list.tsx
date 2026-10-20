"use client";
import { FileText, Trash2 } from "lucide-react";
import type { WorkspaceDocument } from "@/app/actions/upload";

export function DocumentList({ documents, states, onOpen, onDelete, onExtract, disabled }: {
  documents: WorkspaceDocument[]; states: Record<string, string>; onOpen: (id: string) => void;
  onDelete: (doc: WorkspaceDocument) => void; onExtract?: (doc: WorkspaceDocument) => void; disabled?: boolean;
}) {
  if (!documents.length) return null;
  const categories = [
    { label: "Identity Proofs", match: ["id_proof", "photograph"] },
    { label: "Prior / Old Deeds", match: ["prior_title_deed"] },
    { label: "Property & Supporting Documents", match: ["other", "patta", "jamabandi", "loan_papers", "stamp_paper", "naksha_map", "payment_proof"] },
  ];
  return <details className="rounded-xl border border-border bg-card p-4">
    <summary className="cursor-pointer text-sm font-medium text-primary">Uploaded documents <span className="ml-1 text-xs font-normal text-muted-foreground">({documents.length}) · view or remove</span></summary>
    <div className="mt-4 grid gap-5 lg:grid-cols-3">{categories.map((group) => {
      const docs = documents.filter((doc) => group.match.includes(doc.category));
      return <section key={group.label}><h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</h3>{!docs.length ? <p className="text-xs text-muted-foreground">No files yet</p> : <ul className="divide-y divide-border">{docs.map((doc) => <li key={doc.id} className="flex items-start gap-2 py-3">
        <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><div className="min-w-0 flex-1"><button className="block max-w-full truncate text-left text-xs font-medium hover:underline" onClick={() => onOpen(doc.id)} type="button">{doc.file_name}</button><p className="mt-1 text-[11px] text-muted-foreground">{states[doc.id] || "Saved"}</p>{onExtract && !states[doc.id]?.startsWith("Extracted") ? <button disabled={disabled} type="button" onClick={() => onExtract(doc)} className="mt-1 text-[11px] text-primary hover:underline">Extract details</button> : null}</div>
        <button aria-label={"Delete " + doc.file_name} type="button" disabled={disabled} onClick={() => onDelete(doc)} className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="size-3.5" /></button>
      </li>)}</ul>}</section>;
    })}</div>
  </details>;
}
