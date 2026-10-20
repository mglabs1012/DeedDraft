"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRef, useState } from "react";
import { ArrowLeft, ArrowUp, Check, FileText, LoaderCircle, Plus, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { updateDeedTitle, updateRemarks } from "@/app/actions/deeds";
import { createDocumentSignedUrl, deleteDocument, recategorizeDocument } from "@/app/actions/documents";
import { processStandardDocument, saveStandardSection, standardSourceText, toggleStandardModule } from "@/app/actions/standard";
import { generateStandardDraft, loadStandardDrafts } from "@/app/actions/standard-draft";
import { uploadStandardDocuments, type WorkspaceDocument } from "@/app/actions/upload";
import type { SavedDraft } from "@/app/actions/drafts";
import { PartiesSection } from "@/components/deeds/sections/parties";
import type { SaveSection } from "@/components/deeds/sections/shared";
import { Button } from "@/components/ui/button";
import { textareaClass } from "@/components/ui/field";
import type { DeedData } from "@/lib/schemas/deed-data";
import type { LibraryEntry } from "@/lib/templates/catalog";
import { MAX_UPLOAD_BYTES, UPLOAD_ACCEPT } from "@/lib/uploads/policy";
import type { Deed } from "@/types/database";
import { cn } from "@/lib/utils";

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
  const [category, setCategory] = useState<WorkspaceDocument["category"]>("prior_title_deed");
  const [source, setSource] = useState<{ id: string; text: string; quality?: string } | null>(null);
  const [sourceLoading, setSourceLoading] = useState("");
  const sourceRequest = useRef(0);
  const [details, setDetails] = useState(false);
  const [view, setView] = useState<"workspace" | "draft">("workspace");
  const [drafts, setDrafts] = useState<SavedDraft[]>([]);
  const [language, setLanguage] = useState<"hindi" | "english">(deed.language === "english" ? "english" : "hindi");
  const fileInput = useRef<HTMLInputElement>(null);

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
  function upload(files: FileList | File[]) {
    const selected = Array.from(files);
    if (!selected.length) return;
    if (selected.length > 30) { toast.error("Upload up to 30 files at a time."); return; }
    void guarded("Uploading papers…", async () => {
      setNotices([]);
      for (const file of selected) {
        if (file.size > MAX_UPLOAD_BYTES) { setNotices((current) => [...current, file.name + ": exceeds the 20 MB limit."]); continue; }
        setBusy("Uploading " + file.name + "…");
        const form = new FormData();
        form.set("deedId", deed.id); form.set("category", category); form.set("file", file);
        let result: Awaited<ReturnType<typeof uploadStandardDocuments>>;
        try { result = await uploadStandardDocuments(form); }
        catch { setNotices((current) => [...current, file.name + ": upload interrupted. Check your connection and retry."]); continue; }
        setNotices((current) => [...current, ...result.notices, ...(result.error ? [result.error] : [])]);
        setDocuments((current) => [...result.documents, ...current]);
        for (const document of result.documents) {
          setBusy("Reading " + document.file_name + "…");
          await extract(document);
        }
        const prior = result.documents.find((doc) => doc.category === "prior_title_deed");
        if (prior) await showSource(prior.id);
      }
    });
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
  const generate = () => void guarded(aiEnabled ? "Preparing your draft…" : "Preparing the template draft…", async () => {
    const result = await generateStandardDraft({ id: deed.id, language, instructions });
    if (result.error || !result.draft) throw new Error(result.error || "The draft could not be saved.");
    setSavedInstructions(instructions);
    setDrafts((current) => [result.draft!, ...current]);
    setNotices(result.notes ?? []);
    setView("draft");
  });
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
      {busy ? <p role="status" aria-live="polite" className="flex items-center gap-2 text-sm text-primary"><LoaderCircle className="size-4 animate-spin" />{busy} <span className="text-xs text-muted-foreground">Keep this page open.</span></p> : null}
      {notices.length ? <details className="rounded-lg border border-amber-200 bg-amber-50/50 px-4 py-3 text-sm" open><summary className="cursor-pointer font-medium">Please review ({notices.length})</summary><ul className="mt-2 max-h-52 list-disc space-y-1 overflow-auto pl-5 text-xs leading-5">{notices.map((notice, index) => <li key={index}>{notice}</li>)}</ul></details> : null}

      {view === "draft" ? <StandardDraft deed={deed} data={data} firmName={firmName} firmCity={firmCity} aiEnabled={aiEnabled} drafts={drafts} onSaved={(draft) => setDrafts((current) => [draft, ...current])} /> : <>
        <section aria-labelledby="upload-heading">
          <div className={cn("rounded-2xl border-2 border-dashed bg-card px-5 py-10 text-center transition sm:py-14", dragging ? "border-primary bg-primary/5" : "border-border")} onDragOver={(event) => { event.preventDefault(); if (!busy) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); if (!busy) upload(event.dataTransfer.files); }}>
            <UploadCloud className="mx-auto size-8 stroke-[1.3] text-primary" />
            <h2 id="upload-heading" className="mt-4 text-xl font-medium text-primary">Drop your property papers here</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">Prior deeds, identity proofs or supporting papers.<br />AI reads the details; you stay in control.</p>
            <Button type="button" className="mt-5 h-10" disabled={Boolean(busy)} onClick={() => fileInput.current?.click()}><Plus className="size-4" /> Choose files</Button>
            <input aria-label="Upload deed documents" type="file" className="sr-only" ref={fileInput} multiple accept={UPLOAD_ACCEPT} disabled={Boolean(busy)} onChange={(event) => { if (event.target.files) upload(event.target.files); event.target.value = ""; }} />
            <p className="mt-4 text-xs text-muted-foreground">PDF, images, Word, ZIP & RAR · 20 MB per upload</p>
            <label className="mt-4 inline-flex items-center gap-2 text-xs text-muted-foreground">These papers are
              <select aria-label="Document category" className="max-w-48 rounded-md border border-border bg-card px-2 py-1.5 text-foreground" disabled={Boolean(busy)} value={category} onChange={(event) => setCategory(event.target.value as WorkspaceDocument["category"])}>
                <option value="prior_title_deed">Prior title deeds</option><option value="id_proof">Identity proofs</option><option value="naksha_map">Naksha / maps</option><option value="payment_proof">Payment proofs</option><option value="other">Other / mixed papers</option>
              </select>
            </label>
            <p className="mt-2 text-[11px] text-muted-foreground">Archives: up to 30 files / 60 MB unpacked. No encrypted or nested archives.</p>
          </div>
          {documents.length ? <details className="mt-3" open={documents.length <= 3 ? true : undefined}><summary className="cursor-pointer text-xs text-muted-foreground">{documents.length} uploaded paper{documents.length === 1 ? "" : "s"} · manage files</summary>
            <ul className="mt-2 divide-y divide-border">{documents.map((doc) => <li key={doc.id} className="flex flex-wrap items-center gap-2 py-3 text-xs">
              <FileText className="size-4 shrink-0 text-muted-foreground" /><button onClick={() => void openDocument(doc.id)} type="button" className="min-w-0 flex-1 truncate text-left font-medium hover:underline">{doc.file_name}</button>
              <span className="text-muted-foreground">{states[doc.id] || (data.workspace.processedDocuments.includes(doc.id) ? "Extracted · review details" : "Uploaded")}</span>
              <select aria-label={"Category of " + doc.file_name} className="max-w-36 rounded border border-border bg-card p-1" value={doc.category} disabled={Boolean(busy)} onChange={(event) => {
                const nextCategory = event.target.value as WorkspaceDocument["category"];
                void guarded("Updating category…", async () => {
                  const result = await recategorizeDocument({ id: doc.id, category: nextCategory });
                  if (result.error) throw new Error(result.error);
                  setDocuments((current) => current.map((item) => item.id === doc.id ? { ...item, category: nextCategory } : item));
                });
              }}>
                <option value="prior_title_deed">Prior deed</option><option value="id_proof">ID proof</option><option value="naksha_map">Map</option><option value="payment_proof">Payment</option><option value="other">Other</option>
                {!["prior_title_deed", "id_proof", "naksha_map", "payment_proof", "other"].includes(doc.category) ? <option value={doc.category}>{doc.category}</option> : null}
              </select>
              {aiEnabled && !data.workspace.processedDocuments.includes(doc.id) ? <button disabled={Boolean(busy)} className="rounded px-2 py-1 text-primary hover:bg-secondary" onClick={() => void guarded("Reading details…", () => extract(doc))} type="button">Extract</button> : null}
              <button disabled={Boolean(busy)} className="rounded px-2 py-1 text-muted-foreground hover:text-destructive" type="button" onClick={() => {
                if (!window.confirm("Remove this uploaded paper? Extracted details already added to the deed will remain.")) return;
                void guarded("Removing file…", async () => { const result = await deleteDocument({ id: doc.id }); if (result.error) throw new Error(result.error); setDocuments((current) => current.filter((item) => item.id !== doc.id)); if (source?.id === doc.id) setSource(null); });
              }}>Remove</button>
            </li>)}</ul>
          </details> : null}
        </section>

        <section className="rounded-xl border border-border bg-card" aria-labelledby="source-heading">
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

        <fieldset disabled={Boolean(busy)} className="min-w-0">
          <PartiesSection compact deedType={deed.deed_type} parties={data.parties} save={save} documentNames={Object.fromEntries(documents.map((doc) => [doc.id, doc.file_name]))} />
        </fieldset>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="mr-1 text-muted-foreground">Optional sections</span>
          {(["naksha", "consideration"] as const).map((module) => <button key={module} type="button" disabled={Boolean(busy)} aria-pressed={data.workspace.modules[module]} onClick={() => toggle(module)} className={cn("flex items-center gap-1.5 rounded-full border px-3 py-2", data.workspace.modules[module] ? "border-primary/30 bg-primary/5 text-primary" : "border-border text-muted-foreground hover:text-primary")}>{data.workspace.modules[module] ? <Check className="size-3" /> : <Plus className="size-3" />}{module === "naksha" ? "Naksha / map" : "Consideration amount"}</button>)}
          <button type="button" aria-expanded={details} className="ml-auto py-2 text-muted-foreground hover:text-primary" onClick={() => setDetails(!details)}>{details ? "Hide" : "Review"} property & other details</button>
        </div>
        {data.workspace.modules.naksha ? <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-medium text-primary">Naksha / property map</h2><p className="mt-1 text-xs text-muted-foreground">Upload with the “Naksha / maps” category above, then open the original here.</p>
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

        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <label htmlFor="draft-instructions" className="text-sm font-medium text-primary">What should this deed say?</label>
          <textarea id="draft-instructions" className={cn(textareaClass, "mt-3 min-h-32 resize-y border-0 bg-transparent p-0 shadow-none focus:ring-0")} maxLength={4000} value={instructions} onChange={(event) => setInstructions(event.target.value)} placeholder="For example: Retain the title history. Add that possession passes at registration. Remove the arbitration clause. The seller will clear all pending bills." />
          <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border pt-4">
            <label className="text-xs text-muted-foreground">Draft in <select aria-label="Draft language" className="ml-1 rounded-lg border border-border bg-background p-2 text-foreground" value={language} disabled={Boolean(busy)} onChange={(event) => setLanguage(event.target.value as "hindi" | "english")}><option value="hindi">हिंदी</option><option value="english">English</option></select></label>
            <button type="button" disabled={Boolean(busy) || instructions === savedInstructions} className="text-xs text-muted-foreground hover:text-primary disabled:opacity-50" onClick={() => void guarded("Saving instructions…", async () => { const result = await updateRemarks({ id: deed.id, remarks: instructions }); if (result.error) throw new Error(result.error); setSavedInstructions(instructions); toast.success("Instructions saved."); })}>{instructions === savedInstructions ? "Instructions saved" : "Save instructions"}</button>
            <Button className="ml-auto h-10" disabled={Boolean(busy)} onClick={generate} type="button">{busy.includes("draft") ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}{drafts.length ? "Prepare new version" : "Prepare draft"}</Button>
          </div>
          <p className="mt-3 text-[11px] leading-5 text-muted-foreground">AI-generated details and clauses require your review. Missing facts remain blank. Every generated draft is saved as a new version.</p>
        </section>
      </>}
    </div>
  );
}
