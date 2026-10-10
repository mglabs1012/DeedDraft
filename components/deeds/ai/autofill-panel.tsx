"use client";

import { useRef, useState, useTransition } from "react";
import type { FieldValues, Path, PathValue, UseFormReturn } from "react-hook-form";
import { AlertTriangle, CheckCircle2, FileText, LoaderCircle, Sparkles, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";

import { autofillFromDocuments, type AutofillResult } from "@/app/actions/ai";
import { createDocumentRecord } from "@/app/actions/documents";
import { Button } from "@/components/ui/button";
import type { DocumentCategory } from "@/lib/deeds";
import { createClient } from "@/lib/supabase/client";

const ACCEPTED = ["application/pdf", "image/jpeg", "image/png"];
const MAX_BYTES = 20 * 1024 * 1024;

/**
 * Upload papers for one party (Aadhaar, PAN…) or one property (naksha, layout
 * plan, patta…). Files are stored in the matter repository, read by AI, and
 * the result is handed back for the open form to fill. Nothing is saved until
 * the advocate saves the form.
 */
export function AutofillPanel({
  deedId,
  firmId,
  target,
  category,
  title,
  description,
  getRole,
  onResult,
}: {
  deedId: string;
  firmId: string;
  target: "party" | "property";
  category: DocumentCategory;
  title: string;
  description: string;
  getRole?: () => "first" | "second" | "witness" | "other";
  onResult: (result: AutofillResult, documentIds: string[]) => number;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [outcome, setOutcome] = useState<{ filled: number; summary: string; warnings: string[] } | null>(null);
  const [step, setStep] = useState<"idle" | "uploading" | "reading">("idle");
  const [, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const busy = step !== "idle";

  const add = (list: FileList | null) => {
    if (!list) return;
    const valid = Array.from(list).filter((file) => {
      const ok = ACCEPTED.includes(file.type) && file.size <= MAX_BYTES;
      if (!ok) toast.error(file.name + " must be a PDF, JPG or PNG under 20 MB.");
      return ok;
    });
    setFiles((current) => current.concat(valid).slice(0, 5));
    setOutcome(null);
  };

  const run = () =>
    startTransition(async () => {
      setStep("uploading");
      const client = createClient();
      const ids: string[] = [];
      for (const file of files) {
        const storagePath = firmId + "/" + deedId + "/" + crypto.randomUUID() + "-" + file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
        const { error } = await client.storage.from("deed-documents").upload(storagePath, file, { contentType: file.type, upsert: false });
        if (error) {
          toast.error(file.name + ": " + error.message);
          continue;
        }
        const record = await createDocumentRecord({ deedId, category, fileName: file.name, storagePath, mimeType: file.type, sizeBytes: file.size });
        if (record.error || !record.id) {
          await client.storage.from("deed-documents").remove([storagePath]);
          toast.error(record.error ?? "Could not save " + file.name);
          continue;
        }
        ids.push(record.id);
      }
      if (!ids.length) return setStep("idle");

      setStep("reading");
      const response = await autofillFromDocuments({ deedId, documentIds: ids, target, role: getRole?.() }).catch(() => ({ error: "AI reading failed. Please try again." }) as const);
      setStep("idle");
      if (response.error !== undefined) return void toast.error(response.error);
      const filled = onResult(response.result, ids);
      setFiles([]);
      setOutcome({ filled, summary: response.result.summary, warnings: response.result.warnings });
      toast.success(filled ? filled + " field" + (filled === 1 ? "" : "s") + " filled. Please verify before saving." : "No new details found.");
    });

  return (
    <div className="rounded-lg border border-accent/40 bg-accent/10 p-3 sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-card text-accent-foreground">
          <Sparkles className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-primary">{title}</p>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{description}</p>
        </div>
        <Button className="h-9 w-full sm:w-auto" disabled={busy} onClick={() => input.current?.click()} type="button" variant="outline">
          <UploadCloud className="size-4" /> Choose files
        </Button>
        <input accept=".pdf,image/jpeg,image/png" className="hidden" multiple onChange={(event) => { add(event.target.files); event.target.value = ""; }} ref={input} type="file" />
      </div>

      {files.length ? (
        <div className="mt-3 space-y-2">
          <ul className="flex flex-wrap gap-2">
            {files.map((file, index) => (
              <li className="flex max-w-full items-center gap-1.5 rounded-full border border-border bg-card py-1 pl-2.5 pr-1 text-xs" key={file.name + index}>
                <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{file.name}</span>
                <button aria-label={"Remove " + file.name} className="rounded-full p-0.5 text-muted-foreground hover:text-destructive" disabled={busy} onClick={() => setFiles((current) => current.filter((_, i) => i !== index))} type="button">
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
          <Button className="h-9 w-full sm:w-auto" disabled={busy} onClick={run} type="button">
            {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {step === "uploading" ? "Uploading…" : step === "reading" ? "Reading with AI…" : "Fetch details"}
          </Button>
        </div>
      ) : null}

      {outcome ? (
        <div className="mt-3 space-y-2 text-xs">
          <p className="flex items-start gap-1.5 text-emerald-700">
            <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
            <span>{outcome.filled ? "Filled " + outcome.filled + " empty field" + (outcome.filled === 1 ? "" : "s") + "." : "No new details to fill."} {outcome.summary}</span>
          </p>
          {outcome.warnings.map((warning) => (
            <p className="flex items-start gap-1.5 text-amber-800" key={warning}>
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              {warning}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Copies AI values into empty form fields only, so nothing the advocate typed
 * or saved is overwritten. `replaceable` names dropdowns whose untouched
 * default (e.g. gender "male") may be replaced. Returns how many were filled.
 */
export function fillForm<T extends FieldValues>(form: UseFormReturn<T, unknown, unknown>, values: Record<string, unknown>, replaceable: string[] = []) {
  let filled = 0;
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null || value === "" || value === false || Array.isArray(value)) continue;
    const name = key as Path<T>;
    const current = form.getValues(name) as unknown;
    const empty = current === "" || current === undefined || current === null;
    const swappable = replaceable.includes(key) && !form.getFieldState(name).isDirty;
    if ((!empty && !swappable) || current === value) continue;
    form.setValue(name, value as PathValue<T, Path<T>>, { shouldDirty: true, shouldValidate: true });
    filled += 1;
  }
  return filled;
}
