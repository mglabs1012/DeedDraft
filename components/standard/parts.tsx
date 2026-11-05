"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowUp, Check, LoaderCircle, Plus, Square, UploadCloud, UserRound, Users } from "lucide-react";
import { toast } from "sonner";
import { setDeedMode } from "@/app/actions/standard";
import { ModeBadge, type WorkspaceMode } from "@/components/mode-badge";
import { Button } from "@/components/ui/button";
import { textareaClass } from "@/components/ui/field";
import { HelpTip } from "@/components/guided-tour";
import { getDeedType } from "@/lib/deed-types";
import type { PartyRole } from "@/lib/schemas/deed-data";
import { UPLOAD_ACCEPT } from "@/lib/uploads/policy";
import { cn } from "@/lib/utils";
import type { Deed } from "@/types/database";
import { DocumentList } from "./document-list";
import { UploadProgress } from "./upload-progress";
import { UploadWindow } from "./upload-window";
import type { DeedWorkspace, DraftLanguageChoice } from "./use-deed-workspace";

/** Back link, editable title, deed type, mode badge and the switch to the other mode. */
export function WorkspaceHeader({ w, deed, mode, canSwitch, children }: { w: DeedWorkspace; deed: Deed; mode: WorkspaceMode; canSwitch: boolean; children?: React.ReactNode }) {
  const router = useRouter();
  const [switching, startSwitch] = useTransition();
  const other: WorkspaceMode = mode === "premium" ? "standard" : "premium";
  const switchMode = () => startSwitch(async () => {
    const result = await setDeedMode({ id: deed.id, mode: other });
    if (result.error !== undefined) return void toast.error(result.error);
    toast.success(other === "premium" ? "Opened in Premium Mode" : "Opened in Standard Mode", { description: "All papers and details are kept." });
    router.refresh();
  });
  return (
    <header>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <Link href="/app/deeds" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="size-3.5" /> My deeds</Link>
        <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          <span className="truncate">{getDeedType(deed.deed_type).label} · {deed.reference_no}</span>
          <ModeBadge mode={mode} />
          {canSwitch ? <button data-tour="mode-switch" type="button" disabled={switching || w.disabled} onClick={switchMode} className="whitespace-nowrap rounded-md px-1.5 py-1 font-medium text-primary underline-offset-2 hover:underline disabled:opacity-50">{switching ? "Switching…" : other === "premium" ? "Open in Premium" : "Open in Standard"}</button> : null}
        </div>
      </div>
      <label className="mt-3 block"><span className="sr-only">Deed title</span><input aria-label="Deed title" className="w-full text-ellipsis rounded-md border border-transparent bg-transparent py-1 text-xl font-medium tracking-tight text-primary outline-none hover:border-border focus:border-primary sm:text-3xl" value={w.title} maxLength={180} onChange={(event) => w.setTitle(event.target.value)} onBlur={w.saveTitle} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} /></label>
      {children}
    </header>
  );
}

/** AI notice, live drafting stages, extraction status, review notices, upload progress, document list and person upload windows. */
export function StatusArea({ w, deed, aiEnabled, uploadRole, onCloseUpload, showDocuments = true }: { w: DeedWorkspace; deed: Deed; aiEnabled: boolean; uploadRole: PartyRole | null; onCloseUpload: () => void; showDocuments?: boolean }) {
  return <>
    {!aiEnabled ? <p className="rounded-lg border border-border bg-secondary/30 px-4 py-3 text-sm text-muted-foreground">AI is not configured. Upload and manual entry still work. <Link className="underline underline-offset-2" href="/app/settings">Configure AI</Link> to enable reading papers and instruction-led drafting.</p> : null}
    {w.draftStage ? <section className="rounded-2xl border border-primary/15 bg-primary/[.03] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><p role="status" aria-live="polite" className="flex items-center gap-2 text-sm font-medium text-primary"><LoaderCircle className="size-4 animate-spin" />{w.busy}</p><Button variant="outline" className="h-9 shrink-0" type="button" onClick={w.stopDrafting}><Square className="size-3" /> Stop drafting</Button></div>
      <ol className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">{[["loading", "Load facts"], ["converting", "Names in draft language"], ["drafting", "Prepare clauses"], ["saving", "Save version"]].map(([stage, label], index, steps) => {
        const current = steps.findIndex(([key]) => key === w.draftStage);
        return <li key={stage} aria-current={stage === w.draftStage ? "step" : undefined} className={cn("flex items-center gap-2", current >= index ? "text-primary" : "text-muted-foreground")}><span className={cn("grid size-6 shrink-0 place-items-center rounded-full text-[10px]", current >= index ? "bg-primary text-primary-foreground" : "bg-secondary")}>{current > index ? <Check className="size-3" /> : index + 1}</span>{label}</li>;
      })}</ol>
    </section> : w.busy ? <p role="status" aria-live="polite" className="flex items-center gap-2 text-sm text-primary"><LoaderCircle className="size-4 animate-spin" />{w.busy}</p> : null}
    {w.extracting > 0 ? <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground"><LoaderCircle className="size-3.5 animate-spin" />Reading details from {w.extracting} paper{w.extracting === 1 ? "" : "s"}. You can keep working.</p> : null}
    {w.notices.length ? <details className="rounded-lg border border-amber-200 bg-amber-50/50 px-4 py-3 text-sm" open><summary className="cursor-pointer font-medium">Please review ({w.notices.length})</summary><ul className="mt-2 max-h-52 list-disc space-y-1 overflow-auto pl-5 text-xs leading-5">{w.notices.map((notice, index) => <li key={index}>{notice}</li>)}</ul></details> : null}
    <UploadProgress jobs={w.uploads.jobs} pause={w.uploads.pause} resume={w.uploads.resume} />
    {showDocuments ? <DocumentListFor w={w} aiEnabled={aiEnabled} /> : null}
    {uploadRole ? <UploadWindow key={uploadRole} role={uploadRole} deedType={deed.deed_type} documents={w.documents.filter((doc) => w.data.workspace.documentRoles[doc.id] === uploadRole)} jobs={w.uploads.jobs.filter((job) => job.role === uploadRole)} onClose={onCloseUpload} onUpload={(files, category) => w.uploads.enqueue(files, uploadRole, category)} onManual={(party) => w.save("parties", [...w.dataRef.current.parties, party])} onOpen={(id) => void w.openDocument(id)} onDelete={w.removeDocument} pause={w.uploads.pause} resume={w.uploads.resume} /> : null}
  </>;
}

export function DocumentListFor({ w, aiEnabled, open = false }: { w: DeedWorkspace; aiEnabled: boolean; open?: boolean }) {
  return <DocumentList open={open} documents={w.documents} states={{ ...Object.fromEntries(w.data.workspace.processedDocuments.map((id) => [id, "Extracted · review details"])), ...w.states }} onOpen={(id) => void w.openDocument(id)} onDelete={w.removeDocument} onExtract={aiEnabled ? (doc) => void w.guarded("Reading details…", () => w.extract(doc)) : undefined} disabled={w.disabled || w.extracting > 0 || w.uploads.active} />;
}

export function PaperDropzone({ w, compact = false }: { w: DeedWorkspace; compact?: boolean }) {
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  return <div className={cn("rounded-2xl border border-dashed bg-card px-5 text-center transition", compact ? "py-5" : "py-6 sm:py-9", dragging ? "border-primary bg-primary/5" : "border-primary/25")} onDragOver={(event) => { event.preventDefault(); if (!w.busy) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); if (!w.busy) w.uploads.enqueue(event.dataTransfer.files, "other", "prior_title_deed"); }}>
    <UploadCloud className="mx-auto size-8 stroke-[1.3] text-primary" />
    <h3 id="upload-heading" className="mt-3 text-lg font-medium text-primary sm:text-xl">Drop your property papers here<HelpTip text="Start with the previous deed or property papers. Wait for Saved, then check the details read from them. You can resume an interrupted upload." /></h3>
    <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">Old deeds, patta, jamabandi and other property papers. Each person&apos;s ID proofs go in their own box below.</p>
    <Button type="button" className="mt-4 h-10" disabled={w.disabled} onClick={() => fileInput.current?.click()}><Plus className="size-4" /> Choose files</Button>
    <input aria-label="Upload deed documents" type="file" className="sr-only" ref={fileInput} multiple accept={UPLOAD_ACCEPT} disabled={w.disabled} onChange={(event) => { if (event.target.files) w.uploads.enqueue(event.target.files, "other", "prior_title_deed"); event.target.value = ""; }} />
    <p className="mt-3 text-xs text-muted-foreground">PDF, images, Word, ZIP &amp; RAR · 20 MB per upload · archives up to 30 files</p>
  </div>;
}

export function PersonUploads({ w, deed, onOpen }: { w: DeedWorkspace; deed: Deed; onOpen: (role: PartyRole) => void }) {
  const roles = getDeedType(deed.deed_type).roles;
  return <div data-tour="party-uploads" className="grid gap-3 sm:grid-cols-[repeat(3,minmax(0,1fr))]">{(["first", "second", "witness"] as const).map((role) => {
    const count = w.data.parties.filter((party) => party.role === role).length;
    return <button key={role} type="button" disabled={w.disabled} onClick={() => onOpen(role)} className="group flex min-w-0 items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition hover:border-primary/35 hover:shadow-sm">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/5 text-primary">{role === "witness" ? <Users className="size-5" /> : <UserRound className="size-5" />}</span>
      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-primary">{role === "witness" ? "Witnesses" : roles[role].en.split(" (")[0]}</span><span className="mt-0.5 block text-xs text-muted-foreground">{count ? count + " added · add papers or more people" : "Upload ID proofs or add manually"}</span></span>
      <Plus className="size-4 shrink-0 text-muted-foreground group-hover:text-primary" />
    </button>;
  })}</div>;
}

export function PaperReader({ w }: { w: DeedWorkspace }) {
  if (!w.documents.length) return null;
  const priority = (category: string) => (["prior_title_deed", "patta", "jamabandi"].includes(category) ? 0 : 1);
  const ordered = [...w.documents].sort((a, b) => priority(a.category) - priority(b.category));
  return <section data-tour="prior-text" className="rounded-xl border border-border bg-card" aria-labelledby="source-heading">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5"><div className="min-w-0"><h2 id="source-heading" className="font-medium text-primary">Read an uploaded paper</h2><p className="mt-0.5 text-xs text-muted-foreground">See exactly what was read, and compare with the original.</p></div>
      <select aria-label="Read source document" className="w-full min-w-0 rounded-lg border border-border bg-background p-2 text-xs sm:w-auto sm:max-w-72" value={w.sourceLoading || w.source?.id || ""} disabled={Boolean(w.sourceLoading)} onChange={(event) => { if (event.target.value) void w.showSource(event.target.value); }}>
        <option value="">Choose a paper…</option>{ordered.map((doc) => <option value={doc.id} key={doc.id}>{doc.file_name}</option>)}
      </select>
    </div>
    {w.sourceLoading ? <p role="status" className="p-5 text-sm text-muted-foreground">Reading document text…</p> : w.source ? <div className="p-4 sm:p-5">
      {w.source.quality !== "good" ? <p className="mb-3 text-xs text-amber-800">Some text may be unclear. Verify it against the original paper.</p> : null}
      <pre className="max-h-[32rem] min-h-40 overflow-auto whitespace-pre-wrap break-words font-sans text-sm leading-7">{w.source.text || "No readable text found. Try a clearer document or enter the details manually."}</pre>
      <button type="button" onClick={() => void w.openDocument(w.source!.id)} className="mt-3 text-xs text-primary underline underline-offset-2">Compare with original</button>
    </div> : <p className="px-5 py-5 text-center text-sm text-muted-foreground">Choose a paper above to read its text.</p>}
  </section>;
}

export function DraftRequest({ w, hasDrafts }: { w: DeedWorkspace; hasDrafts: boolean }) {
  return <section data-tour="draft-instructions" className="rounded-2xl border border-border bg-card p-4 sm:p-5">
    <label htmlFor="draft-instructions" className="text-sm font-medium text-primary">What should this deed say? <span className="font-normal text-muted-foreground">(optional)</span></label><HelpTip text="Use plain language: explain what to add, keep or remove. Without instructions the standard draft is prepared instantly from your papers. Each preparation saves a new version; old versions are kept." />
    <textarea id="draft-instructions" className={cn(textareaClass, "mt-3 min-h-28 resize-y border-0 bg-transparent p-0 shadow-none focus:ring-0")} maxLength={4000} value={w.instructions} onChange={(event) => w.setInstructions(event.target.value)} placeholder="For example: Retain the title history. Add that possession passes at registration. The seller will clear all pending bills." />
    <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border pt-4">
      <label className="text-xs text-muted-foreground">Draft in <select aria-label="Draft language" className="ml-1 rounded-lg border border-border bg-background p-2 text-foreground" value={w.language} disabled={w.disabled} onChange={(event) => w.setLanguage(event.target.value as DraftLanguageChoice)}><option value="hindi">हिंदी</option><option value="english">English</option><option value="both">Both (हिंदी + English)</option></select></label>
      <button type="button" disabled={w.disabled || w.instructions === w.savedInstructions} className="text-xs text-muted-foreground hover:text-primary disabled:opacity-50" onClick={w.saveInstructions}>{w.instructions === w.savedInstructions ? "Instructions saved" : "Save instructions"}</button>
      <Button data-tour="prepare-draft" className="ml-auto h-10" disabled={w.disabled || w.uploads.active || w.extracting > 0} onClick={w.generate} type="button">{w.draftStage ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}{hasDrafts ? "Prepare new version" : "Prepare draft"}</Button>
    </div>
    <p className="mt-3 text-[11px] leading-5 text-muted-foreground">With instructions, the AI tailors the draft in your firm&apos;s style; without them the standard draft is ready instantly. Missing facts stay blank. Every draft is saved as a new version for your review.</p>
  </section>;
}

export function Step({ n, title, hint }: { n: number; title: string; hint: string }) {
  return <div className="mb-3 flex items-start gap-3">
    <span aria-hidden="true" className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{n}</span>
    <div className="min-w-0"><h2 className="font-semibold text-primary"><span className="sr-only">Step {n}: </span>{title}</h2><p className="text-xs leading-5 text-muted-foreground">{hint}</p></div>
  </div>;
}
