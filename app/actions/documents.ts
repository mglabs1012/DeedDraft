"use server";

import { revalidatePath } from "next/cache";

import {
  createDocumentSchema,
  documentIdSchema,
  recategorizeDocumentSchema,
} from "@/lib/schemas/documents";
import { requireWorkspace } from "@/lib/workspace";
import { userMessage } from "@/lib/errors";

type ActionResult = { error?: string; url?: string; id?: string };

async function findDocument(id: string) {
  const workspace = await requireWorkspace();
  const { data, error } = await workspace.supabase
    .from("deed_documents")
    .select("*")
    .eq("id", id)
    .eq("firm_id", workspace.firm.id)
    .maybeSingle();

  if (error || !data) return { workspace, document: null };
  return { workspace, document: data };
}

export async function createDocumentRecord(input: unknown): Promise<ActionResult> {
  const parsed = createDocumentSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const workspace = await requireWorkspace();
  const { data: deed } = await workspace.supabase
    .from("deeds")
    .select("id")
    .eq("id", parsed.data.deedId)
    .eq("firm_id", workspace.firm.id)
    .maybeSingle();

  if (!deed) return { error: "Deed not found." };

  const expectedPrefix = workspace.firm.id + "/" + parsed.data.deedId + "/";
  if (!parsed.data.storagePath.startsWith(expectedPrefix)) {
    return { error: "Invalid document storage path." };
  }

  const { data: created, error } = await workspace.supabase.from("deed_documents").insert({
    deed_id: parsed.data.deedId,
    firm_id: workspace.firm.id,
    category: parsed.data.category,
    file_name: parsed.data.fileName,
    storage_path: parsed.data.storagePath,
    mime_type: parsed.data.mimeType,
    size_bytes: parsed.data.sizeBytes,
    uploaded_by: workspace.user.id,
  }).select("id").single();

  if (error || !created) return { error: userMessage(error, "Could not save the document.") };

  await workspace.supabase.from("activity_log").insert({
    firm_id: workspace.firm.id,
    deed_id: parsed.data.deedId,
    user_id: workspace.user.id,
    action: "uploaded_document",
    details: { file_name: parsed.data.fileName, category: parsed.data.category },
  });

  revalidatePath("/app/deeds/" + parsed.data.deedId);
  return { id: created.id };
}

export async function recategorizeDocument(input: unknown): Promise<ActionResult> {
  const parsed = recategorizeDocumentSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid document category." };

  const { workspace, document } = await findDocument(parsed.data.id);
  if (!document) return { error: "Document not found." };

  const { error } = await workspace.supabase
    .from("deed_documents")
    .update({ category: parsed.data.category })
    .eq("id", document.id);

  if (error) return { error: userMessage(error) };

  await workspace.supabase.from("activity_log").insert({
    firm_id: workspace.firm.id,
    deed_id: document.deed_id,
    user_id: workspace.user.id,
    action: "recategorized_document",
    details: { file_name: document.file_name, category: parsed.data.category },
  });

  revalidatePath("/app/deeds/" + document.deed_id);
  return {};
}

export async function createDocumentSignedUrl(input: unknown): Promise<ActionResult> {
  const parsed = documentIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid document." };

  const { workspace, document } = await findDocument(parsed.data.id);
  if (!document) return { error: "Document not found." };

  const { data, error } = await workspace.supabase.storage
    .from("deed-documents")
    .createSignedUrl(document.storage_path, 60);

  return error || !data ? { error: userMessage(error, "Could not create preview URL.") } : { url: data.signedUrl };
}

export async function deleteDocument(input: unknown): Promise<ActionResult> {
  const parsed = documentIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid document." };

  const { workspace, document } = await findDocument(parsed.data.id);
  if (!document) return { error: "Document not found." };

  const paths = [document.storage_path];
  const parts = document.storage_path.split("/");
  // New resumable uploads use a private, per-upload folder. Remove its retained
  // source archive/image only when the last document from that upload is deleted.
  if (parts.length === 4 && /^[0-9a-f-]{36}$/i.test(parts[2])) {
    const prefix = parts.slice(0, 3).join("/");
    const { data: siblings, error: readError } = await workspace.supabase.from("deed_documents")
      .select("id").eq("firm_id", workspace.firm.id).eq("deed_id", document.deed_id)
      .like("storage_path", prefix + "/%").neq("id", document.id).limit(1);
    if (readError) return { error: "Could not check related documents. Please retry." };
    if (!siblings?.length) {
      const { data: objects, error: listError } = await workspace.supabase.storage.from("deed-documents").list(prefix, { limit: 100 });
      if (listError) return { error: "Could not check the source files. Please retry." };
      for (const object of objects ?? []) if (object.id && !object.name.includes("/")) paths.push(prefix + "/" + object.name);
    }
  }
  const { error: storageError } = await workspace.supabase.storage
    .from("deed-documents")
    .remove([...new Set(paths)]);
  if (storageError) return { error: userMessage(storageError) };

  const { error } = await workspace.supabase
    .from("deed_documents")
    .delete()
    .eq("id", document.id);
  if (error) return { error: userMessage(error) };

  await workspace.supabase.from("activity_log").insert({
    firm_id: workspace.firm.id,
    deed_id: document.deed_id,
    user_id: workspace.user.id,
    action: "deleted_document",
    details: { file_name: document.file_name },
  });

  revalidatePath("/app/deeds/" + document.deed_id);
  return {};
}
