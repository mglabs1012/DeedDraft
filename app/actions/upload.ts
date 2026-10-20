"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/lib/workspace";
import { documentCategorySchema } from "@/lib/schemas/documents";
import { unpackArchive } from "@/lib/uploads/archives";
import { normalizeUpload } from "@/lib/uploads/normalize";
import { extensionOf, MAX_UPLOAD_BYTES, supportedExtensions } from "@/lib/uploads/policy";
import type { Database } from "@/types/database";

export type WorkspaceDocument = Pick<Database["public"]["Tables"]["deed_documents"]["Row"], "id" | "file_name" | "category" | "mime_type" | "size_bytes">;

export async function uploadStandardDocuments(form: FormData): Promise<{ error?: string; documents: WorkspaceDocument[]; notices: string[] }> {
  const workspace = await requireWorkspace();
  const parsed = z.object({ deedId: z.string().uuid(), category: documentCategorySchema }).safeParse({ deedId: form.get("deedId"), category: form.get("category") ?? "prior_title_deed" });
  const file = form.get("file");
  if (!parsed.success || !(file instanceof File)) return { error: "Choose a document to upload.", documents: [], notices: [] };
  if (!file.size || file.size > MAX_UPLOAD_BYTES) return { error: "Each upload must be between 1 byte and 20 MB.", documents: [], notices: [] };
  const ext = extensionOf(file.name);
  if (!supportedExtensions.has(ext)) return { error: "Choose an image, PDF, Word document, ZIP or RAR file.", documents: [], notices: [] };
  const { data: deed } = await workspace.supabase.from("deeds").select("id").eq("id", parsed.data.deedId).eq("firm_id", workspace.firm.id).maybeSingle();
  if (!deed) return { error: "Deed not found.", documents: [], notices: [] };
  const documents: WorkspaceDocument[] = [];
  const notices: string[] = [];
  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const bundle = ext === "zip" || ext === "rar" ? await unpackArchive(bytes, ext) : { files: [{ name: file.name, bytes }], skipped: [] };
    notices.push(...bundle.skipped.map((name) => "Skipped unsupported file: " + name));
    for (const part of bundle.files) {
      try {
        const normalized = await normalizeUpload(part);
        if (normalized.bytes.length > MAX_UPLOAD_BYTES) throw new Error("Converted document exceeds 20 MB.");
        const name = normalized.name.slice(-250);
        const path = workspace.firm.id + "/" + deed.id + "/" + crypto.randomUUID() + "." + extensionOf(name);
        const { error: uploadError } = await workspace.supabase.storage.from("deed-documents").upload(path, normalized.bytes, { contentType: normalized.mime, upsert: false });
        if (uploadError) throw new Error("Storage upload failed. Check your connection and storage configuration.");
        const { data: record, error: recordError } = await workspace.supabase.from("deed_documents").insert({
          deed_id: deed.id, firm_id: workspace.firm.id, uploaded_by: workspace.user.id,
          category: parsed.data.category, file_name: name, storage_path: path, mime_type: normalized.mime, size_bytes: normalized.bytes.length,
        }).select("id, file_name, category, mime_type, size_bytes").single();
        if (recordError || !record) {
          await workspace.supabase.storage.from("deed-documents").remove([path]);
          throw new Error("Could not save document metadata. Please retry.");
        }
        documents.push(record);
        if (normalized.note) notices.push(part.name + ": " + normalized.note);
      } catch (error) {
        notices.push(part.name + ": " + (error instanceof Error ? error.message : "Could not process this document."));
      }
    }
    revalidatePath("/app/deeds/" + deed.id);
    return { documents, notices, ...(!documents.length ? { error: "No documents were uploaded. See the file details below." } : {}) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "This archive could not be read. Try an unencrypted, single-volume archive.", documents, notices };
  }
}
