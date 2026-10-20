"use client";

import { useState } from "react";
import { FileText, Plus, Trash2, UploadCloud } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { PartyForm } from "@/components/deeds/sections/parties";
import type { WorkspaceDocument } from "@/app/actions/upload";
import type { Party, PartyRole } from "@/lib/schemas/deed-data";
import { getDeedType, type DeedType } from "@/lib/deed-types";
import { UPLOAD_ACCEPT } from "@/lib/uploads/policy";
import { UploadProgress } from "./upload-progress";
import type { UploadJob } from "./use-upload-engine";

export const uploadSections: Array<{ category: WorkspaceDocument["category"]; title: string; hint: string }> = [
  { category: "id_proof", title: "Identity Proofs", hint: "Aadhaar, PAN, passport · one person’s papers at a time" },
  { category: "other", title: "Property Documents", hint: "Patta, land records, property schedules or other papers" },
  { category: "prior_title_deed", title: "Prior / Old Deeds", hint: "Earlier deeds and title documents" },
];
export function UploadWindow({ role, deedType, documents, jobs, onClose, onUpload, onManual, onDelete, onOpen, pause, resume }: {
  role: PartyRole; deedType: DeedType; documents: WorkspaceDocument[]; jobs: UploadJob[];
  onClose: () => void; onUpload: (files: FileList | File[], category: WorkspaceDocument["category"]) => void;
  onManual: (party: Party) => Promise<boolean>; onDelete: (doc: WorkspaceDocument) => void; onOpen: (id: string) => void;
  pause: (id: string) => void; resume: (id: string) => void;
}) {
  const [manual, setManual] = useState(false);
  const [saving, setSaving] = useState(false);
  const roles = getDeedType(deedType).roles;
  const name = role === "witness" ? "Witness" : roles[role].en.split(" (")[0];
  return <Modal open onClose={onClose} className="sm:max-w-4xl" title={name + (manual ? " · Add manually" : " documents")} description="Keep each person’s documents together. You can add multiple people."
    footer={manual ? <><Button variant="ghost" onClick={() => setManual(false)} type="button">Back to uploads</Button><Button form="party-form" type="submit" disabled={saving}>{saving ? "Saving…" : "Save person"}</Button></> : <><p className="mr-auto self-center text-xs text-muted-foreground">PDF, images, ZIP, RAR or Word · 20 MB each</p><button type="button" className="inline-flex items-center justify-center gap-1 text-xs font-medium text-primary hover:underline" onClick={() => setManual(true)}><Plus className="size-3" /> Add Manually</button></>}>
    {manual ? <PartyForm ai={null} defaultRole={role} roleLabels={Object.fromEntries(Object.entries(roles).map(([key, value]) => [key, value.en])) as Record<PartyRole, string>} onSubmit={(party) => { setSaving(true); void onManual(party).then((saved) => { if (saved) setManual(false); }).finally(() => setSaving(false)); }} /> : <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">{uploadSections.map((section) => <section key={section.category} className="rounded-xl border border-border bg-background p-4">
        <h3 className="text-sm font-semibold text-primary">{section.title}</h3><p className="mt-1 min-h-10 text-xs leading-5 text-muted-foreground">{section.hint}</p>
        <label className="mt-3 flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-primary/25 bg-card p-5 text-xs text-primary transition hover:border-primary hover:bg-primary/5" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); onUpload(event.dataTransfer.files, section.category); }}>
          <UploadCloud className="size-5" /><span>Drop files or browse</span><input className="sr-only" aria-label={"Upload " + name + " " + section.title} type="file" multiple accept={UPLOAD_ACCEPT} onChange={(event) => { if (event.target.files) onUpload(event.target.files, section.category); event.target.value = ""; }} />
        </label>
        <ul className="mt-3 space-y-2">{documents.filter((doc) => doc.category === section.category).map((doc) => <li key={doc.id} className="flex items-center gap-1 text-xs"><FileText className="size-3 shrink-0 text-muted-foreground" /><button type="button" onClick={() => onOpen(doc.id)} className="min-w-0 flex-1 truncate text-left hover:underline">{doc.file_name}</button><button type="button" aria-label={"Delete " + doc.file_name} onClick={() => onDelete(doc)} className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="size-3" /></button></li>)}</ul>
      </section>)}</div>
      <UploadProgress jobs={jobs} pause={pause} resume={resume} />
    </div>}
  </Modal>;
}
