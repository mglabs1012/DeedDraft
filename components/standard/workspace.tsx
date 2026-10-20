"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowUp, Check, LoaderCircle, Plus, Square, UploadCloud, UserRound, Users } from "lucide-react";
import { toast } from "sonner";
import { updateDeedTitle, updateRemarks } from "@/app/actions/deeds";
import { createDocumentSignedUrl, deleteDocument } from "@/app/actions/documents";
import { processStandardDocument, saveStandardSection, standardSourceText, toggleStandardModule } from "@/app/actions/standard";
import { loadStandardDrafts } from "@/app/actions/standard-draft";
import type { WorkspaceDocument } from "@/app/actions/upload";
import type { SavedDraft } from "@/app/actions/drafts";
import { PartiesSection } from "@/components/deeds/sections/parties";
import type { SaveSection } from "@/components/deeds/sections/shared";
import { Button } from "@/components/ui/button";
import { textareaClass } from "@/components/ui/field";
import type { DeedData, PartyRole } from "@/lib/schemas/deed-data";
import type { LibraryEntry } from "@/lib/templates/catalog";
import { UPLOAD_ACCEPT } from "@/lib/uploads/policy";
import { getDeedType } from "@/lib/deed-types";
import { streamStandardDraft } from "@/lib/drafting/client-stream";
import { useUploadEngine } from "./use-upload-engine";
import { UploadProgress } from "./upload-progress";
import { UploadWindow } from "./upload-window";
import { DocumentList } from "./document-list";
import type { Deed } from "@/types/database";
import { cn } from "@/lib/utils";
import { HelpTip } from "@/components/guided-tour";

const PropertiesSection = dynamic(() => import("@/components/deeds/sections/properties").then((m) => m.PropertiesSection));
const TitleChainSection = dynamic(() => import("@/components/deeds/sections/title-chain").then((m) => m.TitleChainSection));
const PaymentsSection = dynamic(() => import("@/components/deeds/sections/payments").then((m) => m.PaymentsSection));
const TermsSection = dynamic(() => import("@/components/deeds/sections/terms").then((m) => m.TermsSection));
const CustomDetailsForm = dynamic(() => import("@/components/deeds/custom/custom-document").then((m) => m.CustomDetailsForm));
const StandardDraft = dynamic(() => import("./draft").then((m) => m.StandardDraft), { loading: () => <p className="py-12 text-sm text-muted-foreground">Opening draft…</p> });

export function StandardWorkspace({ deed, initialData, initialDocuments, aiEnabled, firmCity, firmName, template }: {
  deed: Deed; initialData: DeedData; initialDocuments: WorkspaceDocument[]; aiEnabled: boolean;
  firmCity: string; firmName: string; template: LibraryEntry | null;
}) {
  const [data, setData] = useState(initialData);
  const dataRef = useRef(data);
  const acceptData = (next: DeedData) => { dataRef.current = next; setData(next); };
  const [documents, setDocuments] = useState(initialDocuments);
  const [title, setTitle] = useState(deed.title);
  const [instructions, setInstructions] = useState(deed.remarks ?? "");
  const [savedInstructions, setSavedInstructions] = useState(deed.remarks ?? "");
  const [busy, setBusy] = useState("");
  const lock = useRef(false);
  const [notices, setNotices] = useState<string[]>([]);
  const [states, setStates] = useState<Record<string, string>>({});
  const [dragging, setDragging] = useState(false);
  const [uploadRole, setUploadRole] = useState<PartyRole | null>(null);
  const extractionQueue = useRef(Promise.resolve());
  const [extracting, setExtracting] = useState(0);
  const [draftStage, setDraftStage] = useState("");
  const draftAbort = useRef<AbortController | null>(null);
  const [source, setSource] = useState<{ id: string; text: string; quality?: string } | null>(null);
  const [sourceLoading, setSourceLoading] = useState("");
  const sourceRequest = useRef(0);
  const [details, setDetails] = useState(false);
  const [view, setView] = useState<"workspace" | "draft">("workspace");
  const [drafts, setDrafts] = useState<SavedDraft[]>([]);
  const [language, setLanguage] = useState<"hindi" | "english">(deed.language === "english" ? "english" : "hindi");
  const fileInput = useRef<HTMLInputElement>(null);
  const roles = getDeedType(deed.deed_type).roles;
  useEffect(() => () => draftAbort.current?.abort(), []);
  const uploads = useUploadEngine(deed.id, (added, messages, role) => {
    setDocuments((current) => [...added, ...current.filter((doc) => !added.some((item) => item.id === doc.id))]);
    setNotices((current) => [...current, ...messages]);
    acceptData({ ...dataRef.current, workspace: { ...dataRef.current.workspace, documentRoles: { ...dataRef.current.workspace.documentRoles, ...Object.fromEntries(added.map((doc) => [doc.id, role])) } } });
    setExtracting((count) => count + added.length);
    extractionQueue.current = extractionQueue.current.then(async () => {
      for (const doc of added) {
        try { await extract(doc); } finally { setExtracting((count) => count - 1); }
      }
      const prior = added.find((doc) => doc.category === "prior_title_deed");
      if (prior) await showSource(prior.id);
    }).catch(() => { toast.error("Extraction was interrupted. Retry from the document list."); });
  });

  async function guarded(label: string, task: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(label);
    try { await task(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Something went wrong. Your saved work is safe. Please retry."); }
    finally { setBusy(""); lock.current = false; }
  }
  const save: SaveSection = async (section, value) => {
    try {
      const result = await saveStandardSection({ id: deed.id, section, value, expected: dataRef.current[section] });
      if (result.error !== undefined) { toast.error(result.error); return false; }
      acceptData(result.data);
      toast.success("Saved");
      return true;
    } catch { toast.error("Changes were not saved. Check your connection and retry."); return false; }
  };
  async function showSource(id: string) {
    const request = ++sourceRequest.current;
    setSourceLoading(id);
    try {
      const result = await standardSourceText({ deedId: deed.id, documentId: id });
      if (request !== sourceRequest.current) return;
      if (result.error !== undefined) { toast.error(result.error); return; }
      setSource({ id, text: result.text, quality: result.quality });
    } catch { if (request === sourceRequest.current) toast.error("Could not read this paper. Try again."); }
    finally { if (request === sourceRequest.current) setSourceLoading(""); }
  }
  async function extract(document: WorkspaceDocument) {
    setStates((current) => ({ ...current, [document.id]: "Reading details…" }));
    try {
      if (!aiEnabled) {
        setStates((current) => ({ ...current, [document.id]: "Uploaded · manual entry available" }));
        return;
      }
      const result = await processStandardDocument({ deedId: deed.id, documentId: document.id });
      if (result.error !== undefined) throw new Error(result.error);
      acceptData(result.data);
      setStates((current) => ({ ...current, [document.id]: "Extracted · check details below" }));
      if (result.warnings?.length) setNotices((current) => [...current, ...result.warnings!.map((warning) => document.file_name + ": " + warning)]);
    } catch (error) {
      setStates((current) => ({ ...current, [document.id]: "Needs attention · retry extraction" }));
      setNotices((current) => [...current, document.file_name + ": " + (error instanceof Error ? error.message : "Extraction failed. The file is saved; retry below.")]);
    }
  }
  function toggle(module: "naksha" | "consideration") {
    void guarded("Saving workspace…", async () => {
      const result = await toggleStandardModule({ id: deed.id, module, enabled: !dataRef.current.workspace.modules[module] });
      if (result.error !== undefined) throw new Error(result.error);
      acceptData(result.data);
    });
  }
  const openDocument = async (id: string) => {
    const result = await createDocumentSignedUrl({ id });
    if (!result.url) return void toast.error(result.error || "Could not open the original.");
    window.open(result.url, "_blank", "noopener,noreferrer");
  };
  const generate = () => void guarded("Preparing your draft…", async () => {
    const abort = new AbortController(); draftAbort.current = abort; setDraftStage("loading");
    const toastId = toast.loading("Preparing draft", { description: "Loading your papers and instructions" });
    try {
      const result = await streamStandardDraft({ id: deed.id, language, instructions }, abort.signal, (stage, message) => {
        setDraftStage(stage); setBusy(message); toast.loading("Preparing draft", { id: toastId, description: message });
      });
      setSavedInstructions(instructions); setDrafts((current) => [result.draft, ...current]);
      setNotices(result.notes); setView("draft");
      toast.success("Draft saved", { id: toastId, description: "Version " + result.draft.version + " is ready for your review.", duration: 4500 });
    } catch (error) {
      if (abort.signal.aborted) toast.info("Drafting stopped", { id: toastId, description: "Your papers and saved work remain. Check Draft if saving had already started.", duration: 5000 });
      else { toast.error("Drafting did not finish", { id: toastId, description: error instanceof Error ? error.message : "Please retry.", duration: 7000 }); }
    } finally { draftAbort.current = null; setDraftStage(""); }
  });
  const removeDocument = (doc: WorkspaceDocument) => {
    if (!window.confirm("Delete " + doc.file_name + "? Details already extracted into the deed will remain.")) return;
    void guarded("Removing document…", async () => {
      const result = await deleteDocument({ id: doc.id });
      if (result.error) throw new Error(result.error);
      setDocuments((current) => current.filter((item) => item.id !== doc.id));
      if (source?.id === doc.id) setSource(null);
      toast.success("Document removed", { description: "Extracted deed details were kept.", duration: 3500 });
    });
  };
  const openDrafts = () => void guarded("Loading drafts…", async () => {
    const result = await loadStandardDrafts(deed.id);
    if (result.error) throw new Error(result.error);
    if (!result.drafts.length) { toast.info("No draft yet. Upload papers or add details, then prepare your draft."); return; }
    setDrafts(result.drafts);
    setView("draft");
  });
  const priorDocuments = documents.filter((doc) => ["prior_title_deed", "patta", "jamabandi"].includes(doc.category));

  return (
    <div className="space-y-7">
      <header>
        <div className="flex items-center justify-between gap-3">
          <Link href="/app/dashboard" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"><ArrowLeft className="size-3" /> Workspace</Link>
          <span className="text-xs text-muted-foreground">Standard Mode · {deed.reference_no}</span>
        </div>
        <label className="mt-4 block"><span className="sr-only">Deed title</span><input aria-label="Deed title" className="w-full rounded-md border border-transparent bg-transparent py-1 text-2xl font-medium tracking-tight text-primary outline-none hover:border-border focus:border-primary sm:text-3xl" value={title} maxLength={180} onChange={(event) => setTitle(event.target.value)} onBlur={() => {
          if (title.trim() === deed.title) return;
          void updateDeedTitle({ id: deed.id, title }).then((result) => { if (result.error) toast.error(result.error); }).catch(() => toast.error("Title was not saved. Please retry."));
        }} /></label>
        <div className="mt-3 flex gap-5 text-sm">
          <button type="button" className={view === "workspace" ? "font-medium text-primary" : "text-muted-foreground"} onClick={() => setView("workspace")}>Papers & details</button>
          <button type="button" disabled={Boolean(busy)} className={view === "draft" ? "font-medium text-primary" : "text-muted-foreground"} onClick={openDrafts}>Draft</button>
        </div>
      </header>

      {!aiEnabled ? <p className="rounded-lg border border-border bg-secondary/30 px-4 py-3 text-sm text-muted-foreground">AI is not configured. Upload and manual entry still work. <Link className="underline underline-offset-2" href="/app/settings">Configure AI</Link> to enable OCR, extraction and instruction-led drafting.</p> : null}
      {draftStage ? <section className="rounded-2xl border border-primary/15 bg-primary/[.03] p-5">
        <div className="flex items-center justify-between gap-4"><p role="status" aria-live="polite" className="flex items-center gap-2 text-sm font-medium text-primary"><LoaderCircle className="size-4 animate-spin" />{busy}</p><Button variant="outline" className="h-9 shrink-0" type="button" onClick={() => draftAbort.current?.abort()}><Square className="size-3" /> Stop drafting</Button></div>
        <ol className="mt-5 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">{[["loading", "Load facts"], ["converting", "Check language"], ["drafting", "Prepare clauses"], ["saving", "Save version"]].map(([stage, label], index, steps) => {
          const current = steps.findIndex(([key]) => key === draftStage);
          return <li key={stage} aria-current={stage === draftStage ? "step" : undefined} className={cn("flex items-center gap-2", current >= index ? "text-primary" : "text-muted-foreground")}><span className={cn("grid size-6 place-items-center rounded-full text-[10px]", current >= index ? "bg-primary text-primary-foreground" : "bg-secondary")}>{current > index ? <Check className="size-3" /> : index + 1}</span>{label}</li>;
        })}</ol><p className="mt-3 text-[11px] text-muted-foreground">Live server stages, not an estimated percentage. Complex papers may take a few minutes.</p>
      </section> : busy ? <p role="status" aria-live="polite" className="flex items-center gap-2 text-sm text-primary"><LoaderCircle className="size-4 animate-spin" />{busy}</p> : null}
      {extracting > 0 ? <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground"><LoaderCircle className="size-3.5 animate-spin" />Reading details from {extracting} paper{extracting === 1 ? "" : "s"}. Uploads continue independently.</p> : null}
      {notices.length ? <details className="rounded-lg border border-amber-200 bg-amber-50/50 px-4 py-3 text-sm" open><summary className="cursor-pointer font-medium">Please review ({notices.length})</summary><ul className="mt-2 max-h-52 list-disc space-y-1 overflow-auto pl-5 text-xs leading-5">{notices.map((notice, index) => <li key={index}>{notice}</li>)}</ul></details> : null}
      <UploadProgress jobs={uploads.jobs} pause={uploads.pause} resume={uploads.resume} />
      <DocumentList documents={documents} states={{ ...Object.fromEntries(data.workspace.processedDocuments.map((id) => [id, "Extracted · review details"])), ...states }} onOpen={(id) => void openDocument(id)} onDelete={removeDocument} onExtract={aiEnabled ? (doc) => void guarded("Reading details…", () => extract(doc)) : undefined} disabled={Boolean(busy) || extracting > 0 || uploads.active} />
      {uploadRole ? <UploadWindow key={uploadRole} role={uploadRole} deedType={deed.deed_type} documents={documents.filter((doc) => data.workspace.documentRoles[doc.id] === uploadRole)} jobs={uploads.jobs.filter((job) => job.role === uploadRole)} onClose={() => setUploadRole(null)} onUpload={(files, category) => uploads.enqueue(files, uploadRole, category)} onManual={(party) => save("parties", [...dataRef.current.parties, party])} onOpen={(id) => void openDocument(id)} onDelete={removeDocument} pause={uploads.pause} resume={uploads.resume} /> : null}

      {view === "draft" ? <StandardDraft deed={deed} data={data} firmName={firmName} firmCity={firmCity} aiEnabled={aiEnabled} drafts={drafts} onSaved={(draft) => setDrafts((current) => [draft, ...current])} /> : <>
        <section data-tour="paper-upload" aria-labelledby="upload-heading">
          <div className={cn("rounded-2xl border border-dashed bg-card px-5 py-8 text-center transition sm:py-10", dragging ? "border-primary bg-primary/5" : "border-primary/25")} onDragOver={(event) => { event.preventDefault(); if (!busy) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); if (!busy) uploads.enqueue(event.dataTransfer.files, "other", "prior_title_deed"); }}>
            <UploadCloud className="mx-auto size-8 stroke-[1.3] text-primary" />
            <h2 id="upload-heading" className="mt-4 text-xl font-medium text-primary">Drop your property papers here<HelpTip text="Start with the previous deed or property papers. Wait for Saved, then check the details read from them. You can resume an interrupted upload." /></h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">Upload prior deeds here. Use the person-specific windows below for identity proofs and supporting papers.</p>
            <Button type="button" className="mt-5 h-10" disabled={Boolean(busy)} onClick={() => fileInput.current?.click()}><Plus className="size-4" /> Choose files</Button>
            <input aria-label="Upload deed documents" type="file" className="sr-only" ref={fileInput} multiple accept={UPLOAD_ACCEPT} disabled={Boolean(busy)} onChange={(event) => { if (event.target.files) uploads.enqueue(event.target.files, "other", "prior_title_deed"); event.target.value = ""; }} />
            <p className="mt-4 text-xs text-muted-foreground">PDF, images, Word, ZIP & RAR · 20 MB per upload</p>
            <p className="mt-2 text-[11px] text-muted-foreground">Archives: up to 30 files / 60 MB unpacked. No encrypted or nested archives.</p>
          </div>
          <div data-tour="party-uploads" className="mt-4 grid gap-3 sm:grid-cols-3">{(["second", "first", "witness"] as const).map((role) => <button key={role} type="button" disabled={Boolean(busy)} onClick={() => setUploadRole(role)} className="group flex items-center gap-4 rounded-xl border border-border bg-card p-5 text-left transition hover:border-primary/35 hover:shadow-sm"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/5 text-primary">{role === "witness" ? <Users className="size-5" /> : <UserRound className="size-5" />}</span><span className="flex-1"><span className="block text-sm font-semibold text-primary">{role === "witness" ? "Witnesses" : roles[role].en.split(" (")[0]}</span><span className="mt-1 block text-xs text-muted-foreground">Upload documents or add manually</span></span><Plus className="size-4 text-muted-foreground group-hover:text-primary" /></button>)}</div>
        </section>

        <section data-tour="prior-text" className="rounded-xl border border-border bg-card" aria-labelledby="source-heading">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4"><div><h2 id="source-heading" className="font-medium text-primary">Prior Title Deeds</h2><p className="mt-1 text-xs text-muted-foreground">Old document text, alongside the details it provides.</p></div>
            <select aria-label="Read source document" className="max-w-64 rounded-lg border border-border bg-background p-2 text-xs" value={sourceLoading || source?.id || ""} disabled={Boolean(sourceLoading)} onChange={(event) => { if (event.target.value) void showSource(event.target.value); }}>
              <option value="">Read a paper…</option>{[...priorDocuments, ...documents.filter((doc) => !priorDocuments.includes(doc))].map((doc) => <option value={doc.id} key={doc.id}>{doc.file_name}</option>)}
            </select>
          </div>
          {sourceLoading ? <p role="status" className="p-6 text-sm text-muted-foreground">Reading document text…</p> : source ? <div className="p-5">
            {source.quality !== "good" ? <p className="mb-3 text-xs text-amber-800">Some text may be unclear. Verify it against the original paper.</p> : null}
            <pre className="max-h-[32rem] min-h-48 overflow-auto whitespace-pre-wrap break-words font-sans text-sm leading-7">{source.text || "No readable text found. Try a clearer document or enter the details manually."}</pre>
            <button type="button" onClick={() => void openDocument(source.id)} className="mt-4 text-xs text-primary underline underline-offset-2">Compare with original</button>
          </div> : <p className="px-5 py-12 text-center text-sm text-muted-foreground">{documents.length ? "Choose a paper above to read its extracted text." : "Upload a prior deed to read its text here. You can also enter the details below without uploading."}</p>}
        </section>

        <fieldset data-tour="party-details" disabled={Boolean(busy) || extracting > 0} className="min-w-0">
          <PartiesSection compact deedType={deed.deed_type} parties={data.parties} save={save} documentNames={Object.fromEntries(documents.map((doc) => [doc.id, doc.file_name]))} />
        </fieldset>

        <div data-tour="optional-details" className="flex flex-wrap items-center gap-2 text-xs">
          <span className="mr-1 text-muted-foreground">Optional sections<HelpTip text="Naksha means a property map. Consideration means the agreed payment or price. Show these sections when relevant. Hiding them does not delete entered facts." /></span>
          {(["naksha", "consideration"] as const).map((module) => <button key={module} type="button" disabled={Boolean(busy)} aria-pressed={data.workspace.modules[module]} onClick={() => toggle(module)} className={cn("flex items-center gap-1.5 rounded-full border px-3 py-2", data.workspace.modules[module] ? "border-primary/30 bg-primary/5 text-primary" : "border-border text-muted-foreground hover:text-primary")}>{data.workspace.modules[module] ? <Check className="size-3" /> : <Plus className="size-3" />}{module === "naksha" ? "Naksha / map" : "Consideration amount"}</button>)}
          <button type="button" aria-expanded={details} className="ml-auto py-2 text-muted-foreground hover:text-primary" onClick={() => setDetails(!details)}>{details ? "Hide" : "Review"} property & other details</button>
        </div>
        {data.workspace.modules.naksha ? <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-medium text-primary">Naksha / property map</h2><label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-4 py-3 text-xs text-primary"><UploadCloud className="size-4" /> Upload map<input className="sr-only" type="file" multiple accept={UPLOAD_ACCEPT} onChange={(event) => { if (event.target.files) uploads.enqueue(event.target.files, "other", "naksha_map"); event.target.value = ""; }} /></label>
          <ul className="mt-3 space-y-2">{documents.filter((doc) => doc.category === "naksha_map").map((doc) => <li key={doc.id}><button type="button" className="text-sm text-primary underline underline-offset-2" onClick={() => void openDocument(doc.id)}>{doc.file_name}</button></li>)}</ul>
          <label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={data.execution.mapAttached} disabled={Boolean(busy)} onChange={(event) => void save("execution", { ...data.execution, mapAttached: event.target.checked })} />State in the draft that a map is attached</label>
          <p className="mt-1 text-xs text-muted-foreground">Hiding this panel does not remove a map or change the deed.</p>
        </section> : null}
        {data.workspace.modules.consideration ? <fieldset disabled={Boolean(busy)}><PaymentsSection deedType={deed.deed_type} consideration={data.consideration} payments={data.payments} save={save} /></fieldset> : null}
        {details ? <fieldset disabled={Boolean(busy)} className="min-w-0 space-y-5">
          <PropertiesSection deedType={deed.deed_type} properties={data.properties} parties={data.parties} save={save} />
          <TitleChainSection entries={data.titleChain} save={save} />
          <TermsSection deedType={deed.deed_type} terms={data.terms} execution={data.execution} firmCity={firmCity} save={save} />
          {template && data.custom ? <CustomDetailsForm deedId={deed.id} entry={template} custom={data.custom} onSaved={(answers) => acceptData({ ...dataRef.current, custom: { ...dataRef.current.custom!, answers } })} onNext={() => document.getElementById("draft-instructions")?.focus()} /> : null}
        </fieldset> : null}

        <section data-tour="draft-instructions" className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <label htmlFor="draft-instructions" className="text-sm font-medium text-primary">What should this deed say?</label><HelpTip text="Use plain language: explain what to add, keep or remove. Check factual details first. Prepare draft saves a new version; it does not replace your old saved drafts." />
          <textarea id="draft-instructions" className={cn(textareaClass, "mt-3 min-h-32 resize-y border-0 bg-transparent p-0 shadow-none focus:ring-0")} maxLength={4000} value={instructions} onChange={(event) => setInstructions(event.target.value)} placeholder="For example: Retain the title history. Add that possession passes at registration. Remove the arbitration clause. The seller will clear all pending bills." />
          <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border pt-4">
            <label className="text-xs text-muted-foreground">Draft in <select aria-label="Draft language" className="ml-1 rounded-lg border border-border bg-background p-2 text-foreground" value={language} disabled={Boolean(busy)} onChange={(event) => setLanguage(event.target.value as "hindi" | "english")}><option value="hindi">हिंदी</option><option value="english">English</option></select></label>
            <button type="button" disabled={Boolean(busy) || instructions === savedInstructions} className="text-xs text-muted-foreground hover:text-primary disabled:opacity-50" onClick={() => void guarded("Saving instructions…", async () => { const result = await updateRemarks({ id: deed.id, remarks: instructions }); if (result.error) throw new Error(result.error); setSavedInstructions(instructions); toast.success("Instructions saved."); })}>{instructions === savedInstructions ? "Instructions saved" : "Save instructions"}</button>
            <Button data-tour="prepare-draft" className="ml-auto h-10" disabled={Boolean(busy) || uploads.active || extracting > 0} onClick={generate} type="button">{draftStage ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}{drafts.length ? "Prepare new version" : "Prepare draft"}</Button>
          </div>
          <p className="mt-3 text-[11px] leading-5 text-muted-foreground">AI-generated details and clauses require your review. Missing facts remain blank. Every generated draft is saved as a new version.</p>
        </section>
      </>}
    </div>
  );
}
