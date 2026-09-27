"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
  Download,
  FileImage,
  FileText,
  FolderOpen,
  LoaderCircle,
  Pencil,
  Plus,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
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
import { StatusBadge, TypeBadge } from "@/components/deeds/badges";
import { Button } from "@/components/ui/button";
import {
  documentCategories,
  documentCategoryLabels,
  statusLabels,
  type DocumentCategory,
  type DeedStatus,
} from "@/lib/deeds";
import { createClient } from "@/lib/supabase/client";
import type { Database, Deed } from "@/types/database";

type Document = Database["public"]["Tables"]["deed_documents"]["Row"];
type Activity = Database["public"]["Tables"]["activity_log"]["Row"];
type Tab = "overview" | "documents" | "parties" | "properties" | "payments" | "remarks" | "generate";
type UploadItem = { id: string; file: File; category: DocumentCategory; status: "ready" | "uploading" | "complete" | "error" };

const tabs: Array<{ id: Tab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "documents", label: "Documents" },
  { id: "parties", label: "Parties" },
  { id: "properties", label: "Properties" },
  { id: "payments", label: "Consideration & Payments" },
  { id: "remarks", label: "Remarks & Instructions" },
  { id: "generate", label: "Generate" },
];

const inputClass = "h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15";

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
}: {
  deed: Deed;
  documents: Document[];
  activities: Activity[];
  firmId: string;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const [title, setTitle] = useState(deed.title);
  const [editingTitle, setEditingTitle] = useState(false);
  const [status, setStatus] = useState(deed.status);
  const [remarks, setRemarks] = useState(deed.remarks ?? "");
  const [savedState, setSavedState] = useState<"saved" | "saving" | "unsaved">("saved");
  const [pending, startTransition] = useTransition();
  const hasMounted = useRef(false);

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }
    setSavedState("saving");
    const timer = window.setTimeout(() => {
      void updateRemarks({ id: deed.id, remarks }).then((result) => {
        if (result.error) {
          setSavedState("unsaved");
          toast.error(result.error);
        } else {
          setSavedState("saved");
        }
      });
    }, 850);
    return () => window.clearTimeout(timer);
  }, [deed.id, remarks]);

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
    setStatus(nextStatus);
    startTransition(() => {
      void updateDeedStatus({ id: deed.id, status: nextStatus }).then((result) => {
        if (result.error) {
          setStatus(deed.status);
          toast.error(result.error);
        } else {
          toast.success("Status updated.");
        }
      });
    });
  };

  const counts = documents.reduce<Record<string, number>>((all, document) => {
    all[document.category] = (all[document.category] ?? 0) + 1;
    return all;
  }, {});

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <TypeBadge type={deed.deed_type} />
              <StatusBadge status={status} />
              <span className="font-mono text-xs font-semibold text-muted-foreground">{deed.reference_no}</span>
            </div>
            <div className="mt-3 flex items-center gap-2">
              {editingTitle ? (
                <input autoFocus className="h-10 max-w-xl rounded-lg border border-primary bg-background px-3 text-xl font-semibold text-primary outline-none" onBlur={saveTitle} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") saveTitle(); if (event.key === "Escape") { setTitle(deed.title); setEditingTitle(false); } }} value={title} />
              ) : (
                <><h1 className="truncate text-2xl font-semibold tracking-tight text-primary sm:text-3xl">{title}</h1><button aria-label="Edit title" className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-primary" onClick={() => setEditingTitle(true)}><Pencil className="size-4" /></button></>
              )}
            </div>
            <p className="mt-3 text-sm text-muted-foreground">Created {format(new Date(deed.created_at), "d MMM yyyy")} · Last updated {formatDistanceToNow(new Date(deed.updated_at), { addSuffix: true })}</p>
          </div>
          <label className="text-sm font-medium text-primary">
            Matter status
            <select className={"ml-3 " + inputClass} disabled={pending} onChange={(event) => changeStatus(event.target.value as DeedStatus)} value={status}>
              {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        </div>
        <nav className="-mb-5 mt-7 flex gap-1 overflow-x-auto border-t border-border pt-4 sm:-mb-6">
          {tabs.map((item) => <button className={"whitespace-nowrap border-b-2 px-3 pb-4 text-sm font-medium " + (tab === item.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-primary")} key={item.id} onClick={() => setTab(item.id)}>{item.label}</button>)}
        </nav>
      </section>

      {tab === "overview" ? (
        <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="font-semibold text-primary">Matter summary</h2>
            <dl className="mt-5 space-y-4 text-sm">
              <div className="flex justify-between gap-4 border-b border-border pb-3"><dt className="text-muted-foreground">Reference number</dt><dd className="font-mono font-semibold text-primary">{deed.reference_no}</dd></div>
              <div className="flex justify-between gap-4 border-b border-border pb-3"><dt className="text-muted-foreground">Draft language</dt><dd className="font-medium capitalize text-primary">{deed.language}</dd></div>
              <div className="flex justify-between gap-4 border-b border-border pb-3"><dt className="text-muted-foreground">Uploaded documents</dt><dd className="font-semibold text-primary">{documents.length}</dd></div>
              <div><dt className="text-muted-foreground">Document categories</dt><dd className="mt-2 flex flex-wrap gap-2">{Object.entries(counts).length ? Object.entries(counts).map(([category, count]) => <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground" key={category}>{documentCategoryLabels[category as DocumentCategory]} · {count}</span>) : <span className="text-sm text-muted-foreground">No documents uploaded.</span>}</dd></div>
            </dl>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="font-semibold text-primary">Activity</h2>
            {activities.length ? <ol className="mt-5 space-y-5 border-l border-border pl-5">{activities.map((activity) => <li className="relative" key={activity.id}><span className="absolute -left-[1.72rem] top-1 size-2.5 rounded-full bg-accent ring-4 ring-card" /><p className="text-sm font-medium text-primary">{activity.action.replaceAll("_", " ")}</p><p className="mt-1 text-xs text-muted-foreground">{formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}</p></li>)}</ol> : <p className="mt-5 text-sm text-muted-foreground">Activity will appear as this matter develops.</p>}
          </div>
        </section>
      ) : null}
      {tab === "documents" ? <DocumentsTab deedId={deed.id} documents={documents} firmId={firmId} /> : null}
      {tab === "parties" ? <EmptyPlaceholder description="Sellers, buyers and witnesses will be managed here." title="Parties are coming next" /> : null}
      {tab === "properties" ? <EmptyPlaceholder description="Multiple properties with description, boundaries (North, South, East, West), and naksha/map will be managed here." title="Property details are coming next" /> : null}
      {tab === "payments" ? <EmptyPlaceholder description="Total consideration, token amount, cheque and RTGS/UTR payments will be managed here." title="Payments are coming next" /> : null}
      {tab === "remarks" ? <section className="rounded-xl border border-border bg-card p-5 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="font-semibold text-primary">Remarks & Instructions</h2><p className="mt-1 text-sm text-muted-foreground">These notes stay with the matter and guide the next drafting phase.</p></div><span className={"text-sm font-medium " + (savedState === "saved" ? "text-emerald-700" : savedState === "saving" ? "text-amber-700" : "text-destructive")}>{savedState === "saved" ? "Saved" : savedState === "saving" ? "Saving…" : "Not saved"}</span></div><textarea className="mt-5 min-h-72 w-full rounded-lg border border-border bg-background p-4 text-sm leading-6 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" onChange={(event) => setRemarks(event.target.value)} placeholder="Add matter-specific instructions, drafting notes, or follow-ups…" value={remarks} /></section> : null}
      {tab === "generate" ? <section className="rounded-xl border border-border bg-card px-6 py-14 text-center shadow-sm"><FileText className="mx-auto size-9 text-accent-foreground" /><h2 className="mt-4 text-lg font-semibold text-primary">Draft generation is the next phase</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Once parties, properties, and supporting documents are complete, this space will generate a lawyer-reviewed DOCX draft.</p><Button className="mt-6" disabled>Generate Draft (DOCX)</Button></section> : null}
    </div>
  );
}

function DocumentsTab({ deedId, documents, firmId }: { deedId: string; documents: Document[]; firmId: string }) {
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
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">AI extraction from documents — coming soon. Files remain securely stored in this matter repository.</div>
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
          return <div className="p-5" key={category}><h3 className="text-sm font-semibold text-primary">{documentCategoryLabels[category]} <span className="text-muted-foreground">({group.length})</span></h3><div className="mt-3 grid gap-3 md:grid-cols-2">{group.map((document) => <div className="flex min-w-0 items-center gap-3 rounded-lg border border-border p-3" key={document.id}>{document.mime_type.startsWith("image/") ? <FileImage className="size-7 shrink-0 text-accent-foreground" /> : <FileText className="size-7 shrink-0 text-destructive" />}<div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-primary">{document.file_name}</p><p className="mt-0.5 text-xs text-muted-foreground">{Math.round(document.size_bytes / 1024)} KB · {format(new Date(document.created_at), "d MMM yyyy")}</p></div><select aria-label={"Category for " + document.file_name} className="h-8 max-w-32 rounded-md border border-border bg-background px-1 text-xs" disabled={pending} onChange={(event) => startTransition(() => void recategorizeDocument({ id: document.id, category: event.target.value }).then((result) => { if (result.error) toast.error(result.error); else toast.success("Category updated."); }))} value={document.category}>{documentCategories.map((value) => <option key={value} value={value}>{documentCategoryLabels[value]}</option>)}</select><button aria-label={"Preview " + document.file_name} className="rounded-md p-2 text-primary hover:bg-secondary" onClick={() => openPreview(document)}><Download className="size-4" /></button><button aria-label={"Delete " + document.file_name} className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={() => removeDocument(document.id)}><Trash2 className="size-4" /></button></div>)}</div></div>;
        })}</div> : <EmptyPlaceholder description="Upload a title deed, jamabandi, ID proof, map, or payment record to keep it ready for review." title="No documents yet" />}
      </div>
      {preview ? <div className="fixed inset-0 z-50 grid place-items-center bg-primary/50 p-4"><div className="flex h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-card shadow-2xl"><div className="flex items-center justify-between border-b border-border px-4 py-3"><p className="truncate text-sm font-semibold text-primary">{preview.name}</p><div className="flex items-center gap-2"><a className="rounded-md px-2 py-1 text-sm font-semibold text-primary hover:bg-secondary" href={preview.url} rel="noreferrer" target="_blank">Download</a><button aria-label="Close preview" className="rounded-md p-2 hover:bg-secondary" onClick={() => setPreview(null)}><X className="size-4" /></button></div></div>{preview.mime.startsWith("image/") ? <div className="flex flex-1 items-center justify-center bg-secondary/50 p-4"><img alt={preview.name} className="max-h-full max-w-full object-contain" src={preview.url} /></div> : <iframe className="min-h-0 flex-1" src={preview.url} title={preview.name} />}</div></div> : null}
    </section>
  );
}
