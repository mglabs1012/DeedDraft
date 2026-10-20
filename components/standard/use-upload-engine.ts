"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, DetailedError } from "tus-js-client";
import { toast } from "sonner";
import type { finishStandardUpload, prepareStandardUpload, UploadRequest, WorkspaceDocument } from "@/app/actions/upload";
import { uploadRequest } from "@/lib/uploads/request";
import { MAX_UPLOAD_BYTES, supportedExtensions, extensionOf } from "@/lib/uploads/policy";
import type { PartyRole } from "@/lib/schemas/deed-data";

export type UploadState = "queued" | "authorizing" | "uploading" | "retrying" | "paused" | "processing" | "complete" | "error";
export type UploadJob = {
  id: string; file: File; role: PartyRole; category: WorkspaceDocument["category"];
  state: UploadState; sent: number; accepted: number; error?: string; uploaded: boolean;
};
function readableError(error: unknown) {
  const code = error instanceof DetailedError ? error.originalResponse?.getStatus() : undefined;
  if (code === 401 || code === 403) return "Upload authorization expired. Sign in again, then retry.";
  if (code === 413) return "Storage rejected the file size. Maximum 20 MB.";
  if (code === 415) return "Storage rejected this document format.";
  if (code === 400) return "Storage rejected the upload request (HTTP 400). Retry to request a fresh upload authorization.";
  if (code === 409) return "Another upload is using this file destination. Retry processing or start again.";
  if (!navigator.onLine) return "You are offline. Reconnect, then resume this upload.";
  // TUS errors contain signed URLs; never expose them in toasts, logs or the UI.
  return "Transfer interrupted after automatic retries. Resume to continue from the last saved chunk.";
}
export function useUploadEngine(deedId: string, onUploaded: (documents: WorkspaceDocument[], notices: string[], role: PartyRole) => void) {
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const records = useRef(new Map<string, UploadJob>());
  const active = useRef(new Set<string>());
  const handles = useRef(new Map<string, { upload: Upload; reject: (error: Error) => void }>());
  const alive = useRef(true);
  const callback = useRef(onUploaded);
  useEffect(() => { callback.current = onUploaded; }, [onUploaded]);
  const render = () => { if (alive.current) setJobs([...records.current.values()]); };
  const update = (id: string, patch: Partial<UploadJob>) => {
    const current = records.current.get(id);
    if (current) { Object.assign(current, patch); render(); }
  };
  useEffect(() => {
    alive.current = true;
    const currentHandles = handles.current;
    return () => { alive.current = false; for (const { upload, reject } of currentHandles.values()) { void upload.abort(); reject(new Error("paused")); } };
  }, []);

  async function run(job: UploadJob) {
    if (active.current.has(job.id)) return;
    active.current.add(job.id);
    const request: UploadRequest = { deedId, uploadId: job.id, fileName: job.file.name, size: job.file.size, category: job.category, role: job.role };
    try {
      if (!job.uploaded) {
        update(job.id, { state: "authorizing", error: undefined });
        const prepared = await uploadRequest<Awaited<ReturnType<typeof prepareStandardUpload>>>("prepare", request);
        if (prepared.error) throw new Error(prepared.error);
        if (prepared.uploaded) update(job.id, { uploaded: true, sent: job.file.size, accepted: job.file.size });
        else {
        if (!prepared.token || !prepared.path || !prepared.endpoint) throw new Error("Storage could not authorize this file.");
        if (job.state === "paused" || !alive.current) return;
        update(job.id, { state: "uploading" });
        await new Promise<void>((resolve, reject) => {
          const upload = new Upload(job.file, {
            endpoint: prepared.endpoint,
            headers: { "x-signature": prepared.token!, apikey: prepared.publicKey! },
            chunkSize: 6 * 1024 * 1024,
            retryDelays: [0, 1500, 3000, 5000, 10000, 20000],
            uploadDataDuringCreation: true, removeFingerprintOnSuccess: true,
            fingerprint: async () => "deeddraft:signed-v2:" + prepared.path,
            metadata: { bucketName: "deed-documents", objectName: prepared.path!, contentType: prepared.mime!, cacheControl: "3600" },
            onBeforeRequest: (request) => {
              // Time out a stalled chunk, not the whole file. Confirmed chunks remain resumable.
              const xhr = request.getUnderlyingObject() as XMLHttpRequest;
              if (xhr && "timeout" in xhr) {
                // Only stalled transfers time out; slow but progressing chunks can finish.
                xhr.timeout = 0;
                let timer: ReturnType<typeof setTimeout>;
                const reset = () => {
                  clearTimeout(timer);
                  timer = setTimeout(() => {
                    xhr.onerror?.call(xhr, new ProgressEvent("error"));
                    xhr.abort();
                  }, 120000);
                };
                xhr.upload.addEventListener("progress", reset);
                xhr.addEventListener("progress", reset);
                xhr.addEventListener("loadend", () => clearTimeout(timer), { once: true });
                reset();
              }
            },
            onProgress: (sent) => update(job.id, { state: "uploading", sent }),
            onChunkComplete: (_size, accepted) => update(job.id, { accepted }),
            onShouldRetry: (error, attempt) => {
              const status = error.originalResponse?.getStatus() ?? 0;
              const retry = status === 0 || status === 408 || status === 423 || status === 429 || status >= 500;
              if (retry) update(job.id, { state: "retrying", error: "Connection interrupted · retry " + (attempt + 1) });
              return retry;
            },
            onError: (error) => reject(new Error(readableError(error))),
            onSuccess: () => { update(job.id, { uploaded: true, sent: job.file.size, accepted: job.file.size }); resolve(); },
          });
          handles.current.set(job.id, { upload, reject });
          void upload.findPreviousUploads().then((previous) => {
            if (job.state === "paused" || !alive.current) return reject(new Error("paused"));
            const match = previous.find((item) => item.metadata.objectName === prepared.path && item.uploadUrl?.startsWith(prepared.endpoint + "/"));
            if (match) upload.resumeFromPreviousUpload(match);
            upload.start();
          }).catch(reject);
        });
        }
      }
      if (!alive.current || job.state === "paused") return;
      update(job.id, { state: "processing", error: undefined });
      // Bytes already live in storage; a processing retry never resends them.
      const result = await uploadRequest<Awaited<ReturnType<typeof finishStandardUpload>>>("finish", request);
      if (!alive.current) return;
      if (result.documents.length) callback.current(result.documents, result.notices, job.role);
      if (result.error) throw new Error(result.error + (result.notices.length ? " " + result.notices.join(" · ") : ""));
      update(job.id, { state: "complete", error: undefined });
      toast.success("Upload saved", { description: job.file.name, id: "upload-" + job.id, duration: 3500 });
    } catch (error) {
      if (job.state !== "paused" && alive.current) {
        const message = error instanceof Error ? error.message : "Upload did not finish. Retry when ready.";
        update(job.id, { state: "error", error: message });
        toast.error("File needs attention", { description: job.file.name, id: "upload-" + job.id, duration: 6000 });
      }
    } finally {
      active.current.delete(job.id); handles.current.delete(job.id);
      drain();
    }
  }
  function drain() {
    if (!alive.current) return;
    for (const job of records.current.values()) {
      if (active.current.size >= 2) break;
      if (job.state === "queued" && !active.current.has(job.id)) void run(job);
    }
  }
  function enqueue(files: FileList | File[], role: PartyRole, category: WorkspaceDocument["category"]) {
    if (files.length > 30) { toast.error("Choose up to 30 files at a time."); return; }
    for (const file of Array.from(files)) {
      if (!file.size || file.size > MAX_UPLOAD_BYTES || !supportedExtensions.has(extensionOf(file.name))) {
        toast.error("Cannot upload " + file.name, { description: "Use a supported document up to 20 MB." }); continue;
      }
      if ([...records.current.values()].some((job) => job.file.name === file.name && job.file.size === file.size && job.file.lastModified === file.lastModified && job.role === role && job.category === category && job.state !== "complete")) continue;
      const id = crypto.randomUUID();
      records.current.set(id, { id, file, role, category, state: "queued", sent: 0, accepted: 0, uploaded: false });
    }
    render(); drain();
  }
  function pause(id: string) {
    const job = records.current.get(id);
    if (!job || job.state === "processing" || job.state === "complete") return;
    update(id, { state: "paused" });
    const handle = handles.current.get(id);
    if (handle) { void handle.upload.abort(); handle.reject(new Error("paused")); }
  }
  function resume(id: string) { if (active.current.has(id)) return; update(id, { state: "queued", error: undefined }); drain(); }
  return { jobs, enqueue, pause, resume, active: jobs.some((job) => ["queued", "authorizing", "uploading", "retrying", "processing"].includes(job.state)) };
}
