"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Plus, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import type { WorkspaceDocument } from "@/app/actions/upload";
import { PartiesSection } from "@/components/deeds/sections/parties";
import { HelpTip } from "@/components/guided-tour";
import type { SectionId } from "@/lib/deed-types";
import type { DeedData, PartyRole } from "@/lib/schemas/deed-data";
import type { LibraryEntry } from "@/lib/templates/catalog";
import { UPLOAD_ACCEPT } from "@/lib/uploads/policy";
import { cn } from "@/lib/utils";
import type { Deed } from "@/types/database";
import { DraftRequest, PaperDropzone, PaperReader, PersonUploads, StatusArea, Step, WorkspaceHeader } from "./parts";
import { useDeedWorkspace } from "./use-deed-workspace";

const PropertiesSection = dynamic(() => import("@/components/deeds/sections/properties").then((m) => m.PropertiesSection));
const TitleChainSection = dynamic(() => import("@/components/deeds/sections/title-chain").then((m) => m.TitleChainSection));
const PaymentsSection = dynamic(() => import("@/components/deeds/sections/payments").then((m) => m.PaymentsSection));
const TermsSection = dynamic(() => import("@/components/deeds/sections/terms").then((m) => m.TermsSection));
const CustomDetailsForm = dynamic(() => import("@/components/deeds/custom/custom-document").then((m) => m.CustomDetailsForm));
const StandardDraft = dynamic(() => import("./draft").then((m) => m.StandardDraft), { loading: () => <p className="py-12 text-sm text-muted-foreground">Opening draft…</p> });

/** Standard Mode: one guided page — papers, people, property and terms, then the draft. */
export function StandardWorkspace({ deed, initialData, initialDocuments, aiEnabled, firmCity, firmName, template, initialView = "workspace" }: {
  deed: Deed; initialData: DeedData; initialDocuments: WorkspaceDocument[]; aiEnabled: boolean;
  firmCity: string; firmName: string; template: LibraryEntry | null; initialView?: "workspace" | "draft";
}) {
  const [view, setViewState] = useState<"workspace" | "draft">(initialView);
  // Once opened, the draft stays mounted (hidden) while details are corrected, so unsaved edits are kept.
  const [draftSeen, setDraftSeen] = useState(initialView === "draft");
  const [details, setDetails] = useState(false);
  const [uploadRole, setUploadRole] = useState<PartyRole | null>(null);
  const w = useDeedWorkspace({ deed, initialData, initialDocuments, aiEnabled, onDraftsReady: () => setView("draft") });
  const { data } = w;
  // The title may be renamed in the header; drafts and exports use the saved one.
  const current = useMemo(() => ({ ...deed, title: w.savedTitle }), [deed, w.savedTitle]);

  function setView(next: "workspace" | "draft") {
    setViewState(next);
    if (next === "draft") setDraftSeen(true);
    try { window.history.replaceState(null, "", next === "draft" ? "?tab=draft" : window.location.pathname); } catch { /* URL sync is a convenience only */ }
  }
  // Opened on the draft (a link, or switching from Premium's Draft tab): load the saved versions.
  useEffect(() => { if (initialView === "draft") void w.fetchDrafts().then((all) => { if (!all.length) setViewState("workspace"); }, (error: unknown) => { setViewState("workspace"); toast.error(error instanceof Error ? error.message : "Draft versions could not be loaded."); }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** From the draft back to the details, opened at the part a check points to. */
  function editDetails(section?: SectionId) {
    setView("workspace");
    const target = section === "parties" ? "step-people" : section === "documents" ? "step-papers" : section ? "step-details" : "step-people";
    if (target === "step-details") setDetails(true);
    requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" })));
  }

  return (
    <div className="space-y-7">
      <WorkspaceHeader w={w} deed={deed} mode="standard" canSwitch={!data.custom} place={view === "draft" ? "draft" : "overview"}>
        <div role="tablist" aria-label="Deed sections" className="mt-3 flex gap-1 border-b border-border text-sm">
          <button type="button" role="tab" aria-selected={view === "workspace"} className={cn("-mb-px border-b-2 px-3 py-2.5", view === "workspace" ? "border-primary font-medium text-primary" : "border-transparent text-muted-foreground hover:text-primary")} onClick={() => setView("workspace")}>Papers &amp; details</button>
          <button type="button" role="tab" aria-selected={view === "draft"} disabled={w.disabled} className={cn("-mb-px border-b-2 px-3 py-2.5", view === "draft" ? "border-primary font-medium text-primary" : "border-transparent text-muted-foreground hover:text-primary")} onClick={w.openDrafts}>Draft{w.drafts.length ? " (" + new Set(w.drafts.map((draft) => draft.language)).size + ")" : ""}</button>
        </div>
      </WorkspaceHeader>

      <StatusArea w={w} deed={deed} aiEnabled={aiEnabled} uploadRole={uploadRole} onCloseUpload={() => setUploadRole(null)} />

      {draftSeen ? <div hidden={view !== "draft"}><StandardDraft key={w.generation} active={view === "draft"} ready={w.draftsReady} deed={current} onEditDetails={editDetails} onDirtyChange={w.markUnsaved} data={data} firmName={firmName} firmCity={firmCity} aiEnabled={aiEnabled} drafts={w.drafts} onSaved={(draft) => w.setDrafts((current) => [draft, ...current])} onLocalized={(localized) => w.acceptData({ ...w.dataRef.current, localized })} /></div> : null}

      {view === "workspace" ? <div className="appear space-y-7">
        <section id="step-papers" data-tour="paper-upload" aria-labelledby="upload-heading" className="scroll-mt-20 space-y-4">
          <Step n={1} title="Add the papers" hint="Old deeds and property papers here; each person's ID proofs in their own box." />
          <PaperDropzone w={w} />
          <PersonUploads w={w} deed={deed} onOpen={setUploadRole} />
        </section>

        <PaperReader w={w} />

        <fieldset id="step-people" data-tour="party-details" disabled={w.disabled || w.extracting > 0} className="min-w-0 scroll-mt-20">
          <Step n={2} title="Check the people" hint="Filled from the papers where possible. Every name, relation, age, address and ID number goes into the deed exactly as shown; add anyone missing." />
          <PartiesSection compact deedType={deed.deed_type} parties={data.parties} save={w.save} documentNames={Object.fromEntries(w.documents.map((doc) => [doc.id, doc.file_name]))} />
        </fieldset>

        <section id="step-details" className="scroll-mt-20 space-y-3">
          <Step n={3} title="Property, payment & terms" hint="The property schedule, earlier title history and terms of this deed." />
          <button type="button" aria-expanded={details} onClick={() => setDetails(!details)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3.5 text-left text-sm transition hover:border-primary/35 sm:px-5">
            <span className="min-w-0"><span className="block font-medium text-primary">{details ? "Hide" : "Review"} property, title history &amp; terms</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{[data.properties.length + " propert" + (data.properties.length === 1 ? "y" : "ies"), data.titleChain.length + " title entr" + (data.titleChain.length === 1 ? "y" : "ies"), data.consideration.total ? "₹" + data.consideration.total.toLocaleString("en-IN") : ""].filter(Boolean).join(" · ")}{data.properties.length ? "" : " — add the property before drafting"}</span></span>
            <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition", details && "rotate-180")} />
          </button>
          <div data-tour="optional-details" className="flex flex-wrap items-center gap-2 text-xs">
            <span className="mr-1 text-muted-foreground">Optional sections<HelpTip text="Naksha means a property map. Consideration means the agreed payment or price. Show these sections when relevant. Hiding them does not delete entered facts." /></span>
            {(["naksha", "consideration"] as const).map((module) => <button key={module} type="button" disabled={w.disabled} aria-pressed={data.workspace.modules[module]} onClick={() => w.toggleModule(module)} className={cn("flex items-center gap-1.5 rounded-full border px-3 py-2", data.workspace.modules[module] ? "border-primary/30 bg-primary/5 text-primary" : "border-border text-muted-foreground hover:text-primary")}>{data.workspace.modules[module] ? <Check className="size-3" /> : <Plus className="size-3" />}{module === "naksha" ? "Naksha / map" : "Consideration amount"}</button>)}
          </div>
          {data.workspace.modules.naksha ? <NakshaPanel w={w} /> : null}
          {data.workspace.modules.consideration ? <fieldset disabled={w.disabled}><PaymentsSection deedType={deed.deed_type} consideration={data.consideration} payments={data.payments} save={w.save} /></fieldset> : null}
          {details ? <fieldset disabled={w.disabled} className="min-w-0 space-y-5">
            <PropertiesSection deedType={deed.deed_type} properties={data.properties} parties={data.parties} save={w.save} />
            <TitleChainSection entries={data.titleChain} save={w.save} />
            <TermsSection deedType={deed.deed_type} terms={data.terms} execution={data.execution} firmCity={firmCity} save={w.save} />
            {template && data.custom ? <CustomDetailsForm deedId={deed.id} entry={template} custom={data.custom} onSaved={(answers) => w.acceptData({ ...w.dataRef.current, custom: { ...w.dataRef.current.custom!, answers } })} onNext={() => document.getElementById("draft-instructions")?.focus()} /> : null}
          </fieldset> : null}
        </section>

        <div>
          <Step n={4} title="Prepare the draft" hint="Optional instructions, then choose Hindi, English or both." />
          <DraftRequest w={w} hasDrafts={w.drafts.length > 0} />
        </div>
      </div> : null}
    </div>
  );
}

export function NakshaPanel({ w }: { w: ReturnType<typeof useDeedWorkspace> }) {
  return <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
    <h2 className="font-medium text-primary">Naksha / property map</h2>
    <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-4 py-3 text-xs text-primary"><UploadCloud className="size-4" /> Upload map<input className="sr-only" type="file" multiple accept={UPLOAD_ACCEPT} onChange={(event) => { if (event.target.files) w.uploads.enqueue(event.target.files, "other", "naksha_map"); event.target.value = ""; }} /></label>
    <ul className="mt-3 space-y-2">{w.documents.filter((doc) => doc.category === "naksha_map").map((doc) => <li key={doc.id} className="min-w-0"><button type="button" className="max-w-full truncate text-sm text-primary underline underline-offset-2" onClick={() => void w.openDocument(doc.id)}>{doc.file_name}</button></li>)}</ul>
    <label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={w.data.execution.mapAttached} disabled={w.disabled} onChange={(event) => void w.save("execution", { ...w.data.execution, mapAttached: event.target.checked })} />State in the draft that a map is attached</label>
    <p className="mt-1 text-xs text-muted-foreground">Hiding this panel does not remove a map or change the deed.</p>
  </section>;
}
