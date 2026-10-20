"use server";

import { createHash } from "node:crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/lib/workspace";
import { documentCategorySchema } from "@/lib/schemas/documents";
import { unpackArchive } from "@/lib/uploads/archives";
import { normalizeUpload } from "@/lib/uploads/normalize";
import { extensionOf, MAX_UPLOAD_BYTES } from "@/lib/uploads/policy";
import { mimeForUpload, signedUploadEndpoint } from "@/lib/uploads/mime";
import { uploadPaths } from "@/lib/uploads/paths";
import { assignDocumentRoles } from "./standard";
import type { Database } from "@/types/database";

export type WorkspaceDocument = Pick<Database["public"]["Tables"]["deed_documents"]["Row"], "id" | "file_name" | "category" | "mime_type" | "size_bytes">;
const uploadSchema = z.object({
  deedId: z.string().uuid(), uploadId: z.string().uuid(), fileName: z.string().min(1).max(255),
  size: z.number().int().positive().max(MAX_UPLOAD_BYTES),
  category: documentCategorySchema, role: z.enum(["first", "second", "witness", "other"]).default("other"),
});
export type UploadRequest = z.input<typeof uploadSchema>;

async function context(input: unknown) {
  const parsed = uploadSchema.safeParse(input);
  if (!parsed.success) throw new Error("Check the file size (20 MB maximum) and name.");
  const mime = mimeForUpload(parsed.data.fileName);
  if (!mime) throw new Error("Unsupported file format.");
  const workspace = await requireWorkspace();
  const { data: deed } = await workspace.supabase.from("deeds").select("id").eq("id", parsed.data.deedId).eq("firm_id", workspace.firm.id).maybeSingle();
  if (!deed) throw new Error("Deed not found or your session has expired.");
  const paths = uploadPaths(workspace.firm.id, deed.id, parsed.data.uploadId, extensionOf(parsed.data.fileName));
  return { workspace, input: parsed.data, mime, ...paths };
}

/** Small authorization request only. File bytes travel directly to private Storage. */
export async function prepareStandardUpload(input: unknown) {
  try {
    const ctx = await context(input);
    const { data: stored } = await ctx.workspace.supabase.storage.from("deed-documents").info(ctx.path);
    if (stored?.size === ctx.input.size) return { uploaded: true, path: ctx.path };
    const { data, error } = await ctx.workspace.supabase.storage.from("deed-documents").createSignedUploadUrl(ctx.path);
    if (error || !data) {
      // Log only classification, never signed URLs, tokens or user filenames.
      const status = error && "statusCode" in error ? String(error.statusCode) : "unknown";
      console.error("[upload:authorize]", { status, name: error?.name });
      return { error: status === "401"
        ? "Your session expired. Sign in again, then retry."
        : "Storage could not authorize this upload. Retry; if it persists, the workspace administrator must check storage permissions.",
        retryable: ["429", "500", "502", "503", "504"].includes(status) };
    }
    return { token: data.token, path: ctx.path, mime: ctx.mime, endpoint: signedUploadEndpoint(process.env.NEXT_PUBLIC_SUPABASE_URL!), publicKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! };
  } catch (error) { return { error: error instanceof Error ? error.message : "Could not prepare upload." }; }
}

function stableDocumentId(uploadId: string, index: number) {
  const bytes = createHash("sha256").update(uploadId + ":" + index).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50; bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join("-");
}

/** Idempotent finalization: retries reuse deterministic row/object IDs, never duplicate documents. */
export async function finishStandardUpload(input: unknown): Promise<{ error?: string; documents: WorkspaceDocument[]; notices: string[] }> {
  const documents: WorkspaceDocument[] = [], notices: string[] = [];
  try {
    const ctx = await context(input);
    const storage = ctx.workspace.supabase.storage.from("deed-documents");
    const ext = extensionOf(ctx.input.fileName);
    const firstId = stableDocumentId(ctx.input.uploadId, 0);
    // Normal documents can return immediately on a retry after a lost response.
    if (ext !== "zip" && ext !== "rar") {
      const { data: existing } = await ctx.workspace.supabase.from("deed_documents").select("id, file_name, category, mime_type, size_bytes").eq("id", firstId).eq("firm_id", ctx.workspace.firm.id).eq("deed_id", ctx.input.deedId).maybeSingle();
      if (existing) {
        const assigned = await assignDocumentRoles({ id: ctx.input.deedId, documentIds: [existing.id], role: ctx.input.role });
        return { documents: [existing], notices: [], ...(assigned.error ? { error: assigned.error } : {}) };
      }
    }
    const { data: blob, error: downloadError } = await storage.download(ctx.path);
    if (downloadError || !blob) throw new Error("Upload is not available in storage yet. Retry processing; the file does not need to be uploaded again.");
    if (blob.size !== ctx.input.size || blob.size > MAX_UPLOAD_BYTES) throw new Error("The uploaded file size did not match. Please upload it again.");
    const bytes = Buffer.from(await blob.arrayBuffer());
    const bundle = ext === "zip" || ext === "rar" ? await unpackArchive(bytes, ext) : { files: [{ name: ctx.input.fileName, bytes }], skipped: [] };
    notices.push(...bundle.skipped.map((name) => "Skipped unsupported file: " + name));
    for (const [index, part] of bundle.files.entries()) {
      const id = stableDocumentId(ctx.input.uploadId, index);
      const { data: existing } = await ctx.workspace.supabase.from("deed_documents").select("id, file_name, category, mime_type, size_bytes").eq("id", id).eq("firm_id", ctx.workspace.firm.id).eq("deed_id", ctx.input.deedId).maybeSingle();
      if (existing) { documents.push(existing); continue; }
      try {
        const normalized = await normalizeUpload(part);
        if (normalized.bytes.length > MAX_UPLOAD_BYTES) throw new Error("Converted document exceeds 20 MB.");
        const name = normalized.name.slice(-250);
        const original = bundle.files.length === 1 && ext !== "zip" && ext !== "rar" && normalized.bytes === bytes;
        const path = original ? ctx.path : ctx.prefix + index + "." + extensionOf(name);
        if (!original) {
          const { error } = await storage.upload(path, normalized.bytes, { contentType: normalized.mime, upsert: true });
          if (error) throw new Error("Converted file could not be stored. Retry processing.");
        }
        const { data: record, error } = await ctx.workspace.supabase.from("deed_documents").upsert({
          id, deed_id: ctx.input.deedId, firm_id: ctx.workspace.firm.id, uploaded_by: ctx.workspace.user.id,
          category: ctx.input.category, file_name: name, storage_path: path, mime_type: normalized.mime, size_bytes: normalized.bytes.length,
        }, { onConflict: "id", ignoreDuplicates: true }).select("id, file_name, category, mime_type, size_bytes").maybeSingle();
        if (error) throw new Error("Document metadata could not be saved. Retry processing.");
        if (record) documents.push(record);
        else {
          const { data: concurrent } = await ctx.workspace.supabase.from("deed_documents").select("id, file_name, category, mime_type, size_bytes").eq("id", id).eq("firm_id", ctx.workspace.firm.id).maybeSingle();
          if (concurrent) documents.push(concurrent);
        }
        if (normalized.note) notices.push(part.name + ": " + normalized.note);
      } catch (error) { notices.push(part.name + ": " + (error instanceof Error ? error.message : "Processing failed.")); }
    }
    if (documents.length) {
      const assigned = await assignDocumentRoles({ id: ctx.input.deedId, documentIds: documents.map((doc) => doc.id), role: ctx.input.role });
      if (assigned.error) notices.push(assigned.error);
    }
    // Source containers are retained privately so a processing retry can recover partial success.
    revalidatePath("/app/deeds/" + ctx.input.deedId);
    return { documents, notices, ...(documents.length < bundle.files.length ? { error: "Some files still need attention. Retry processing to recover them without uploading again." } : {}) };
  } catch (error) { return { error: error instanceof Error ? error.message : "Processing failed. Your uploaded bytes can be retried.", documents, notices }; }
}
