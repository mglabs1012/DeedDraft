"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  Download,
  FileImage,
  FileText,
  FolderOpen,
  LoaderCircle,
  Pencil,
  Plus,
  Trash2,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  updateDeedSection,
  updateDeedStatus,
  updateDeedTitle,
  updateRemarks,
} from "@/app/actions/deeds";
import {
  createDocumentRecord,
  createDocumentSignedUrl,
  deleteDocument,
  recategorizeDocument,
} from "@/app/actions/documents";
import { extractFromDocument } from "@/app/actions/ai";
import { ExtractionReview } from "@/components/deeds/ai/extraction-review";
import { StatusBadge, TypeBadge } from "@/components/deeds/badges";
import { DraftGenerator } from "@/components/deeds/draft-generator";
import { PartiesSection } from "@/components/deeds/sections/parties";
import { PaymentsSection } from "@/components/deeds/sections/payments";
import { PropertiesSection } from "@/components/deeds/sections/properties";
import type { SaveSection } from "@/components/deeds/sections/shared";
import { TermsSection } from "@/components/deeds/sections/terms";
import { TitleChainSection } from "@/components/deeds/sections/title-chain";
import { Button } from "@/components/ui/button";
import { getDeedType, sectionsFor, type SectionId } from "@/lib/deed-types";
import {
  activityLabel,
  documentCategories,
  documentCategoryLabels,
  formatINR,
  languageLabels,
  statusLabels,
  type DocumentCategory,
  type DeedStatus,
} from "@/lib/deeds";
import { getReadiness, paymentsTotal } from "@/lib/drafting";
import { displayName } from "@/lib/drafting/format";
import type { Extraction } from "@/lib/ai/parse";
import type { DeedData } from "@/lib/schemas/deed-data";
import { createClient } from "@/lib/supabase/client";
import type { Database, Deed } from "@/types/database";

type Document = Database["public"]["Tables"]["deed_documents"]["Row"];
type Activity = Database["public"]["Tables"]["activity_log"]["Row"];
type Tab = "overview" | SectionId | "remarks" | "generate";
type UploadItem = { id: string; file: File; category: DocumentCategory; status: "ready" | "uploading" | "complete" | "error" };

const inputClass = "h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15";

const sectionLabels: Record<SectionId, string> = {
  parties: "Parties",
  properties: "Property",
  title: "Chain of title",
  payments: "Consideration & payments",
  terms: "Terms & execution",
  documents: "Documents",
};

function EmptyPlaceholder({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-secondary/30 px-6 py-14 text-center">
      <FolderOpen className="mx-auto size-8 text-accent-foreground" />
      <h2 className="mt-4 font-semibold text-primary">{title}</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}

export function DeedDetail({
  deed,
  documents,
  activities,
  firmId,
  firmName,
  firmCity,
  initialData,
  aiEnabled = false,
}: {
  aiEnabled?: boolean;
  deed: Deed;
  documents: Document[];
  activities: Activity[];
  firmId: string;
  firmName: string;
  firmCity: string;
  initialData: DeedData;
}) {
  const config = getDeedType(deed.deed_type);
  const [tab, setTab] = useState<Tab>("overview");
  const [title, setTitle] = useState(deed.title);
  const [editingTitle, setEditingTitle] = useState(false);
  const [status, setStatus] = useState(deed.status);
  const [remarks, setRemarks] = useState(deed.remarks ?? "");
  const [data, setData] = useState<DeedData>(initialData);
  const [savedState, setSavedState] = useState<"saved" | "saving" | "unsaved">("saved");
  const [pending, startTransition] = useTransition();
  const savedRemarks = useRef(deed.remarks ?? "");
  const [extractingId, setExtractingId] = useState<string | null>(null);
  const [extraction, setExtraction] = useState<{ result: Extraction; fileName: string } | null>(null);

  const extract = (document: Document) => {
    setExtractingId(document.id);
    const toastId = toast.loading("Reading " + document.file_name + " with AI…");
    void extractFromDocument({ deedId: deed.id, documentId: document.id })
      .then((result) => {
        if (result.error !== undefined) return toast.error(result.error, { id: toastId });
        toast.success("Extraction ready for review.", { id: toastId });
        setExtraction({ result: result.extraction, fileName: document.file_name });
      })
      .catch(() => toast.error("AI extraction failed. Please try again.", { id: toastId }))
      .finally(() => setExtractingId(null));
  };
  const readiness = getReadiness(deed.deed_type, data, documents.length);
  const readyCount = readiness.filter((item) => item.done).length;
  const counts: Partial<Record<SectionId, number>> = {
    parties: data.parties.length,
    properties: data.properties.length,
    title: data.titleChain.length,
    payments: data.payments.length,
    documents: documents.length,
  };

  const tabs: Array<{ id: Tab; label: string; count?: number }> = [
    { id: "overview", label: "Overview" },
    ...sectionsFor(deed.deed_type).map((section) => ({ id: section as Tab, label: sectionLabels[section], count: counts[section] })),
    { id: "remarks", label: "Remarks" },
    { id: "generate", label: "Generate draft" },
  ];

  // Debounced autosave; compares with the last saved value so it never fires on mount.
  useEffect(() => {
    if (remarks === savedRemarks.current) return;
    const timer = window.setTimeout(() => {
      setSavedState("saving");
      void updateRemarks({ id: deed.id, remarks }).then((result) => {
        if (result.error) {
          setSavedState("unsaved");
          toast.error(result.error);
        } else {
          savedRemarks.current = remarks;
          setSavedState("saved");
        }
      });
    }, 850);
    return () => window.clearTimeout(timer);
  }, [deed.id, remarks]);

  const saveSection = useCallback<SaveSection>(
    async (section, value) => {
      const result = await updateDeedSection({ id: deed.id, section, value });
      if (result.error) {
        toast.error(result.error);
        return false;
      }
      setData((current) => ({ ...current, [section]: value }));
      toast.success("Saved.");
      return true;
    },
    [deed.id],
  );

  const saveTitle = () => {
    const nextTitle = title.trim();
    if (!nextTitle || nextTitle === deed.title) return setEditingTitle(false);
    startTransition(() => {
      void updateDeedTitle({ id: deed.id, title: nextTitle }).then((result) => {
        if (result.error) return toast.error(result.error);
        toast.success("Title saved.");
        setEditingTitle(false);
      });
    });
  };

  const changeStatus = (nextStatus: DeedStatus) => {
    const previous = status;
    setStatus(nextStatus);
    startTransition(() => {
      void updateDeedStatus({ id: deed.id, status: nextStatus }).then((result) => {
        if (result.error) {
          setStatus(previous);
          toast.error(result.error);
        } else {
          toast.success("Status updated.");
        }
      });
    });
  };

  const docCounts = documents.reduce<Record<string, number>>((all, document) => {
    all[document.category] = (all[document.category] ?? 0) + 1;
    return all;
  }, {});
  const total = data.consideration.total ?? 0;
  const names = (role: "first" | "second") => data.parties.filter((party) => party.role === role).map((party) => displayName(party, "hindi")).join(", ") || "—";

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-card px-4 pt-5 shadow-sm sm:px-6 sm:pt-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <TypeBadge type={deed.deed_type} />
              <StatusBadge status={status} />
              <span className="font-mono text-xs font-semibold text-muted-foreground">{deed.reference_no}</span>
              <span className="font-devanagari text-xs text-muted-foreground">{config.labelHi}</span>
            </div>
            <div className="mt-3 flex items-start gap-2">
              {editingTitle ? (
                <input autoFocus className="h-11 w-full max-w-xl rounded-lg border border-primary bg-background px-3 text-lg font-semibold text-primary outline-none sm:text-xl" onBlur={saveTitle} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") saveTitle(); if (event.key === "Escape") { setTitle(deed.title); setEditingTitle(false); } }} value={title} />
              ) : (
                <><h1 className="min-w-0 break-words text-2xl font-semibold tracking-tight text-primary sm:text-3xl">{title}</h1><button aria-label="Edit title" className="mt-1 shrink-0 rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-primary" onClick={() => setEditingTitle(true)}><Pencil className="size-4" /></button></>
              )}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">Created {format(new Date(deed.created_at), "d MMM yyyy")} · Updated {formatDistanceToNow(new Date(deed.updated_at), { addSuffix: true })}</p>
          </div>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-primary sm:flex-row sm:items-center sm:gap-3">
            Matter status
            <select className={inputClass + " w-full sm:w-48"} disabled={pending} onChange={(event) => changeStatus(event.target.value as DeedStatus)} value={status}>
              {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        </div>
        <nav className="-mx-4 mt-5 flex gap-1 overflow-x-auto border-t border-border px-2 sm:-mx-6 sm:px-4 [scrollbar-width:none]">
          {tabs.map((item) => (
            <button className={"flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-3.5 text-sm font-medium transition " + (tab === item.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-primary")} key={item.id} onClick={() => setTab(item.id)} type="button">
              {item.label}
              {item.count ? <span className="rounded-full bg-secondary px-1.5 text-xs font-semibold text-secondary-foreground">{item.count}</span> : null}
            </button>
          ))}
        </nav>
      </section>

      {tab === "overview" ? (
        <section className="grid gap-6 lg:grid-cols-2 xl:grid-cols-[1fr_1fr_1.1fr]">
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold text-primary">Drafting checklist</h2>
              <span className="text-sm font-semibold text-primary">{readyCount}/{readiness.length}</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-accent transition-all" style={{ width: (readyCount / readiness.length) * 100 + "%" }} /></div>
            <ul className="mt-4 space-y-1">
              {readiness.map((item) => (
                <li key={item.label}>
                  <button className="group flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-secondary" onClick={() => setTab(item.tab)} type="button">
                    {item.done ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" /> : <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
                    <span className={"flex-1 " + (item.done ? "text-foreground" : "text-muted-foreground")}>{item.label}{item.optional ? <span className="text-xs"> · recommended</span> : null}</span>
                    <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
                  </button>
                </li>
              ))}
            </ul>
            <Button className="mt-4 h-10 w-full" onClick={() => setTab("generate")} type="button">Preview draft <ArrowRight className="size-4" /></Button>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
            <h2 className="font-semibold text-primary">Matter summary</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4 border-b border-border pb-3"><dt className="text-muted-foreground">Reference</dt><dd className="font-mono font-semibold text-primary">{deed.reference_no}</dd></div>
              <div className="flex justify-between gap-4 border-b border-border pb-3"><dt className="text-muted-foreground">Draft language</dt><dd className="font-medium text-primary">{languageLabels[deed.language]}</dd></div>
              <div className="flex justify-between gap-4 border-b border-border pb-3"><dt className="shrink-0 text-muted-foreground">{config.roles.first.en}</dt><dd className="min-w-0 truncate text-right font-medium text-primary">{names("first")}</dd></div>
              <div className="flex justify-between gap-4 border-b border-border pb-3"><dt className="shrink-0 text-muted-foreground">{config.roles.second.en}</dt><dd className="min-w-0 truncate text-right font-medium text-primary">{names("second")}</dd></div>
              {config.consideration !== "none" ? <div className="flex justify-between gap-4 border-b border-border pb-3"><dt className="text-muted-foreground">Consideration</dt><dd className="text-right font-semibold text-primary">{total ? formatINR(total) : "—"}{total ? <span className="block text-xs font-normal text-muted-foreground">{formatINR(paymentsTotal(data))} received</span> : null}</dd></div> : null}
              {config.terms === "tenancy" ? <div className="flex justify-between gap-4 border-b border-border pb-3"><dt className="text-muted-foreground">Monthly rent</dt><dd className="text-right font-semibold text-primary">{data.terms.monthlyRent ? formatINR(data.terms.monthlyRent) : "—"}{data.terms.termMonths ? <span className="block text-xs font-normal text-muted-foreground">{data.terms.termMonths} months</span> : null}</dd></div> : null}
              <div><dt className="text-muted-foreground">Documents</dt><dd className="mt-2 flex flex-wrap gap-2">{Object.entries(docCounts).length ? Object.entries(docCounts).map(([category, count]) => <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground" key={category}>{documentCategoryLabels[category as DocumentCategory] ?? category} · {count}</span>) : <span className="text-sm text-muted-foreground">No documents uploaded.</span>}</dd></div>
            </dl>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5 lg:col-span-2 xl:col-span-1">
            <h2 className="font-semibold text-primary">Activity</h2>
            {activities.length ? <ol className="mt-5 max-h-96 space-y-5 overflow-y-auto border-l border-border pl-5">{activities.map((activity) => <li className="relative" key={activity.id}><span className="absolute -left-[1.72rem] top-1 size-2.5 rounded-full bg-accent ring-4 ring-card" /><p className="text-sm font-medium text-primary">{activityLabel(activity.action)}</p><p className="mt-1 text-xs text-muted-foreground">{formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}</p></li>)}</ol> : <p className="mt-5 text-sm text-muted-foreground">Activity will appear as this matter develops.</p>}
          </div>
        </section>
      ) : null}
      {tab === "parties" ? <PartiesSection deedType={deed.deed_type} parties={data.parties} save={saveSection} /> : null}
      {tab === "properties" ? <PropertiesSection deedType={deed.deed_type} parties={data.parties} properties={data.properties} save={saveSection} /> : null}
      {tab === "title" ? <TitleChainSection entries={data.titleChain} save={saveSection} /> : null}
      {tab === "payments" ? <PaymentsSection consideration={data.consideration} deedType={deed.deed_type} payments={data.payments} save={saveSection} /> : null}
      {tab === "terms" ? <TermsSection aiEnabled={aiEnabled} deedId={deed.id} deedLanguage={deed.language} deedType={deed.deed_type} execution={data.execution} firmCity={firmCity} save={saveSection} terms={data.terms} /> : null}
      {tab === "documents" ? <DocumentsTab aiEnabled={aiEnabled} deedId={deed.id} documents={documents} extractingId={extractingId} firmId={firmId} onExtract={extract} /> : null}
      {tab === "remarks" ? <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5"><div className="flex items-start justify-between gap-4"><div><h2 className="font-semibold text-primary">Remarks & Instructions</h2><p className="mt-1 text-sm text-muted-foreground">Client instructions and drafting notes. These will also guide AI drafting later.</p></div><span className={"shrink-0 text-sm font-medium " + (savedState === "saved" ? "text-emerald-700" : savedState === "saving" ? "text-amber-700" : "text-destructive")}>{savedState === "saved" ? "Saved" : savedState === "saving" ? "Saving…" : "Not saved"}</span></div><textarea className="mt-5 min-h-72 w-full rounded-lg border border-border bg-background p-4 text-sm leading-6 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" onChange={(event) => setRemarks(event.target.value)} placeholder="Add matter-specific instructions, drafting notes, or follow-ups…" value={remarks} /></section> : null}
      {tab === "generate" ? <DraftGenerator aiEnabled={aiEnabled} city={firmCity} deedId={deed.id} data={data} firmName={firmName} language={deed.language} onJump={setTab} onMarkGenerated={() => changeStatus("generated")} pending={pending} readiness={readiness} referenceNo={deed.reference_no} status={status} title={title} type={deed.deed_type} /> : null}
      {extraction ? <ExtractionReview data={data} deedType={deed.deed_type} extraction={extraction.result} fileName={extraction.fileName} onClose={() => setExtraction(null)} save={saveSection} /> : null}
    </div>
  );
}

function DocumentsTab({
  deedId,
  documents,
  firmId,
  aiEnabled,
  extractingId,
  onExtract,
}: {
  deedId: string;
  documents: Document[];
  firmId: string;
  aiEnabled: boolean;
  extractingId: string | null;
  onExtract: (document: Document) => void;
}) {
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [preview, setPreview] = useState<{ url: string; name: string; mime: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  const addFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const candidates = Array.from(fileList).filter((file) => {
      const valid = ["application/pdf", "image/jpeg", "image/png"].includes(file.type) && file.size <= 20 * 1024 * 1024;
      if (!valid) toast.error(file.name + " must be a PDF, JPG, or PNG under 20 MB.");
      return valid;
    });
    setUploads((current) => current.concat(candidates.map((file) => ({ id: crypto.randomUUID(), file, category: "other", status: "ready" }))));
  };

  const updateUpload = (id: string, changes: Partial<UploadItem>) => setUploads((current) => current.map((item) => item.id === id ? { ...item, ...changes } : item));

  const uploadAll = () => {
    startTransition(() => {
      void (async () => {
        const client = createClient();
        for (const item of uploads.filter((upload) => upload.status === "ready" || upload.status === "error")) {
          updateUpload(item.id, { status: "uploading" });
          const safeName = item.file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
          const storagePath = firmId + "/" + deedId + "/" + crypto.randomUUID() + "-" + safeName;
          const { error: uploadError } = await client.storage.from("deed-documents").upload(storagePath, item.file, { contentType: item.file.type, upsert: false });
          if (uploadError) {
            updateUpload(item.id, { status: "error" });
            toast.error(uploadError.message);
            continue;
          }
          const result = await createDocumentRecord({ deedId, category: item.category, fileName: item.file.name, storagePath, mimeType: item.file.type, sizeBytes: item.file.size });
          if (result.error) {
            await client.storage.from("deed-documents").remove([storagePath]);
            updateUpload(item.id, { status: "error" });
            toast.error(result.error);
          } else {
            updateUpload(item.id, { status: "complete" });
          }
        }
        toast.success("Document upload finished.");
      })();
    });
  };

  const openPreview = (document: Document) => {
    startTransition(() => void createDocumentSignedUrl({ id: document.id }).then((result) => {
      if (result.error || !result.url) return toast.error(result.error ?? "Could not open document.");
      setPreview({ url: result.url, name: document.file_name, mime: document.mime_type });
    }));
  };

  const removeDocument = (id: string) => {
    startTransition(() => void deleteDocument({ id }).then((result) => {
      if (result.error) toast.error(result.error); else toast.success("Document deleted.");
    }));
  };

  return (
    <section className="space-y-5">
      {aiEnabled ? <div className="flex gap-3 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-accent-foreground"><Sparkles className="mt-0.5 size-4 shrink-0" /><p>Use <strong>Extract with AI</strong> on any paper (sale deed, patta, jamabandi, loan letter, Kruti Dev or scanned PDFs up to 10 MB) to pull parties, property, chain of title and payments into this matter for your review. The file is sent to the configured AI provider via OpenRouter.</p></div> : <div className="rounded-xl border border-border bg-secondary/40 px-4 py-3 text-sm text-muted-foreground">AI extraction is available once an OpenRouter API key is configured. Files remain securely stored in this matter repository.</div>}
      <div className="rounded-xl border border-dashed border-primary/30 bg-card p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div><h2 className="font-semibold text-primary">Upload supporting documents</h2><p className="mt-1 text-sm text-muted-foreground">PDF, JPG, or PNG · maximum 20 MB each.</p></div>
          <Button onClick={() => fileInput.current?.click()} type="button" variant="outline"><Plus className="size-4" /> Choose files</Button>
          <input accept=".pdf,image/jpeg,image/png" className="hidden" multiple onChange={(event) => addFiles(event.target.files)} ref={fileInput} type="file" />
        </div>
        <button className="mt-5 flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 py-8 text-center hover:bg-secondary/40" onClick={() => fileInput.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); addFiles(event.dataTransfer.files); }} type="button"><UploadCloud className="size-7 text-accent-foreground" /><span className="mt-3 text-sm font-semibold text-primary">Drag files here or choose from your computer</span><span className="mt-1 text-xs text-muted-foreground">Files are kept private to this firm and matter.</span></button>
        {uploads.length ? <div className="mt-5 space-y-2">{uploads.map((upload) => <div className="flex flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-center" key={upload.id}><FileText className="size-5 text-muted-foreground" /><p className="min-w-0 flex-1 truncate text-sm font-medium">{upload.file.name}</p><select className={inputClass + " w-full sm:w-44"} disabled={upload.status !== "ready" && upload.status !== "error"} onChange={(event) => updateUpload(upload.id, { category: event.target.value as DocumentCategory })} value={upload.category}>{documentCategories.map((category) => <option key={category} value={category}>{documentCategoryLabels[category]}</option>)}</select><span className={"text-xs font-semibold " + (upload.status === "complete" ? "text-emerald-700" : upload.status === "error" ? "text-destructive" : upload.status === "uploading" ? "text-amber-700" : "text-muted-foreground")}>{upload.status === "uploading" ? "Uploading…" : upload.status === "complete" ? "Uploaded" : upload.status === "error" ? "Retry" : "Ready"}</span><button aria-label={"Remove " + upload.file.name} className="p-1 text-muted-foreground hover:text-destructive" disabled={upload.status === "uploading"} onClick={() => setUploads((current) => current.filter((item) => item.id !== upload.id))} type="button"><X className="size-4" /></button></div>)}</div> : null}
        {uploads.some((upload) => upload.status !== "complete") ? <div className="mt-5 flex justify-end"><Button disabled={pending} onClick={uploadAll} type="button">{pending ? <LoaderCircle className="size-4 animate-spin" /> : <UploadCloud className="size-4" />} Upload selected files</Button></div> : null}
      </div>
      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-4"><h2 className="font-semibold text-primary">Repository</h2><p className="mt-1 text-sm text-muted-foreground">{documents.length ? documents.length + " file" + (documents.length === 1 ? "" : "s") + " grouped by category." : "Upload supporting documents to begin the repository."}</p></div>
        {documents.length ? <div className="divide-y divide-border">{documentCategories.map((category) => {
          const group = documents.filter((document) => document.category === category);
          if (!group.length) return null;
          return <div className="p-4 sm:p-5" key={category}><h3 className="text-sm font-semibold text-primary">{documentCategoryLabels[category]} <span className="text-muted-foreground">({group.length})</span></h3><div className="mt-3 grid gap-3 md:grid-cols-2">{group.map((document) => <div className="flex min-w-0 flex-wrap items-center gap-3 rounded-lg border border-border p-3 sm:flex-nowrap" key={document.id}>{document.mime_type.startsWith("image/") ? <FileImage className="size-7 shrink-0 text-accent-foreground" /> : <FileText className="size-7 shrink-0 text-destructive" />}<div className="min-w-0 flex-1 basis-40"><p className="truncate text-sm font-medium text-primary">{document.file_name}</p><p className="mt-0.5 text-xs text-muted-foreground">{Math.round(document.size_bytes / 1024)} KB · {format(new Date(document.created_at), "d MMM yyyy")}</p></div><select aria-label={"Category for " + document.file_name} className="h-8 max-w-36 flex-1 rounded-md border sm:flex-none border-border bg-background px-1 text-xs" disabled={pending} onChange={(event) => startTransition(() => void recategorizeDocument({ id: document.id, category: event.target.value }).then((result) => { if (result.error) toast.error(result.error); else toast.success("Category updated."); }))} value={document.category}>{documentCategories.map((value) => <option key={value} value={value}>{documentCategoryLabels[value]}</option>)}</select>{aiEnabled ? <button aria-label={"Extract details from " + document.file_name + " with AI"} className="rounded-md p-2 text-accent-foreground hover:bg-accent/15 disabled:opacity-40" disabled={extractingId !== null} onClick={() => onExtract(document)} title="Extract with AI">{extractingId === document.id ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}</button> : null}<button aria-label={"Preview " + document.file_name} className="rounded-md p-2 text-primary hover:bg-secondary" onClick={() => openPreview(document)}><Download className="size-4" /></button><button aria-label={"Delete " + document.file_name} className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={() => removeDocument(document.id)}><Trash2 className="size-4" /></button></div>)}</div></div>;
        })}</div> : <EmptyPlaceholder description="Upload a title deed, jamabandi, ID proof, map, or payment record to keep it ready for review." title="No documents yet" />}
      </div>
      {preview ? <div className="fixed inset-0 z-50 grid place-items-center bg-primary/50 p-4"><div className="flex h-[85dvh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-card shadow-2xl"><div className="flex items-center justify-between border-b border-border px-4 py-3"><p className="truncate text-sm font-semibold text-primary">{preview.name}</p><div className="flex items-center gap-2"><a className="rounded-md px-2 py-1 text-sm font-semibold text-primary hover:bg-secondary" href={preview.url} rel="noreferrer" target="_blank">Download</a><button aria-label="Close preview" className="rounded-md p-2 hover:bg-secondary" onClick={() => setPreview(null)}><X className="size-4" /></button></div></div>{preview.mime.startsWith("image/") ? <div className="flex flex-1 items-center justify-center bg-secondary/50 p-4"><img alt={preview.name} className="max-h-full max-w-full object-contain" src={preview.url} /></div> : <iframe className="min-h-0 flex-1" src={preview.url} title={preview.name} />}</div></div> : null}
    </section>
  );
}
