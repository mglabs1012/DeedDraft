"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { AI_NOT_CONFIGURED, AiError, generateJson, isAiConfigured, usageDetails } from "@/lib/ai/claude";
import { builtInReferences, loadFirmMemory } from "@/lib/ai/memory.server";
import { stylePrompt } from "@/lib/ai/prompts";
import { anonymiseDraft, readReferenceDraft } from "@/lib/ai/references.server";
import { deedTypeIds, type DeedType } from "@/lib/deed-types";
import { requireWorkspace } from "@/lib/workspace";
import type { AiMemory } from "@/types/database";

type Result<T = object> = { error: string } | ({ error?: undefined } & T);

const MIGRATION_HINT = "AI memory needs the database update in supabase/migrations/202610100004_ai_memory.sql. Run it in the Supabase SQL editor.";
const deedType = z.enum(deedTypeIds);
const ACCEPTED = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "image/jpeg", "image/png"];

export type MemoryItem = Pick<AiMemory, "id" | "kind" | "deed_type" | "language" | "title" | "source" | "enabled" | "created_at"> & { preview: string; length: number };
export type BuiltInItem = { id: string; deedType: DeedType; language: string; title: string; length: number };

const toItem = (row: AiMemory): MemoryItem => ({
  id: row.id,
  kind: row.kind,
  deed_type: row.deed_type,
  language: row.language,
  title: row.title,
  source: row.source,
  enabled: row.enabled,
  created_at: row.created_at,
  preview: row.kind === "note" ? row.content : row.content.slice(0, 280),
  length: row.content.length,
});

export async function listMemory(): Promise<Result<{ available: boolean; notes: MemoryItem[]; references: MemoryItem[]; builtIns: BuiltInItem[] }>> {
  const workspace = await requireWorkspace();
  const memory = await loadFirmMemory(workspace, { enabledOnly: false });
  const builtIns = (await builtInReferences()).map((ref) => ({ id: ref.id, deedType: ref.deedType, language: ref.language, title: ref.title, length: ref.content.length }));
  return { available: memory.available, notes: memory.notes.map(toItem), references: memory.references.map(toItem), builtIns };
}

export async function getMemoryContent(input: unknown): Promise<Result<{ title: string; content: string }>> {
  const parsed = z.object({ id: z.string().max(80) }).safeParse(input);
  if (!parsed.success) return { error: "Not found." };
  const workspace = await requireWorkspace();
  const builtIn = (await builtInReferences()).find((ref) => ref.id === parsed.data.id);
  if (builtIn) return { title: builtIn.title, content: builtIn.content };
  if (!z.string().uuid().safeParse(parsed.data.id).success) return { error: "Not found." };
  const { data } = await workspace.supabase.from("ai_memory").select("title, content").eq("id", parsed.data.id).eq("firm_id", workspace.firm.id).maybeSingle();
  return data ? { title: data.title, content: data.content } : { error: "Not found." };
}

async function insertMemory(workspace: Awaited<ReturnType<typeof requireWorkspace>>, row: Pick<AiMemory, "kind" | "content"> & Partial<Pick<AiMemory, "deed_type" | "language" | "title" | "source">>): Promise<string | null> {
  const { error } = await workspace.supabase.from("ai_memory").insert({ ...row, firm_id: workspace.firm.id, created_by: workspace.user.id });
  if (error) return error.code === "42P01" || error.code === "PGRST205" ? MIGRATION_HINT : error.message;
  revalidatePath("/app/settings/ai");
  return null;
}

/** A standing instruction the AI follows, for all deeds or one deed type. */
export async function saveNote(input: unknown): Promise<Result> {
  const parsed = z.object({ id: z.string().uuid().optional(), content: z.string().trim().min(3, "Write the instruction.").max(2000), deedType: deedType.nullable().optional(), source: z.enum(["manual", "ai", "chat"]).optional() }).safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid instruction." };
  const workspace = await requireWorkspace();
  if (parsed.data.id) {
    const { error } = await workspace.supabase.from("ai_memory").update({ content: parsed.data.content, deed_type: parsed.data.deedType ?? null, updated_at: new Date().toISOString() }).eq("id", parsed.data.id).eq("firm_id", workspace.firm.id);
    if (error) return { error: error.message };
    revalidatePath("/app/settings/ai");
    return {};
  }
  const error = await insertMemory(workspace, { kind: "note", content: parsed.data.content, deed_type: parsed.data.deedType ?? null, title: "", source: parsed.data.source ?? "manual" });
  return error ? { error } : {};
}

export async function setMemoryEnabled(input: unknown): Promise<Result> {
  const parsed = z.object({ id: z.string().uuid(), enabled: z.boolean() }).safeParse(input);
  if (!parsed.success) return { error: "Invalid request." };
  const workspace = await requireWorkspace();
  const { error } = await workspace.supabase.from("ai_memory").update({ enabled: parsed.data.enabled, updated_at: new Date().toISOString() }).eq("id", parsed.data.id).eq("firm_id", workspace.firm.id);
  if (error) return { error: error.message };
  revalidatePath("/app/settings/ai");
  return {};
}

export async function deleteMemory(input: unknown): Promise<Result> {
  const parsed = z.object({ id: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { error: "Invalid request." };
  const workspace = await requireWorkspace();
  const { error } = await workspace.supabase.from("ai_memory").delete().eq("id", parsed.data.id).eq("firm_id", workspace.firm.id);
  if (error) return { error: error.message };
  revalidatePath("/app/settings/ai");
  return {};
}

/** Upload an accepted / registered draft (PDF, Word, photo). It is read, anonymised and kept as a reference. */
export async function uploadReference(formData: FormData): Promise<Result<{ item: MemoryItem }>> {
  if (!isAiConfigured()) return { error: AI_NOT_CONFIGURED };
  const file = formData.get("file");
  const override = deedType.safeParse(formData.get("deedType"));
  if (!(file instanceof File)) return { error: "Choose a file." };
  if (!ACCEPTED.includes(file.type)) return { error: "Upload a PDF, Word (.docx), JPG or PNG file." };
  if (file.size > 20 * 1024 * 1024) return { error: "The file must be under 20 MB." };
  const workspace = await requireWorkspace();
  try {
    const result = await readReferenceDraft({ bytes: new Uint8Array(await file.arrayBuffer()), mimeType: file.type, fileName: file.name });
    return await storeReference(workspace, { ...result, deedType: override.success ? override.data : result.deedType }, "upload");
  } catch (error) {
    return { error: error instanceof AiError ? error.message : "Could not read this document. Please try again." };
  }
}

/** Paste the text of an accepted draft instead of uploading a file. */
export async function pasteReference(input: unknown): Promise<Result<{ item: MemoryItem }>> {
  const parsed = z.object({ text: z.string().trim().min(300, "Paste the full deed text.").max(150000), deedType: deedType.optional() }).safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid text." };
  if (!isAiConfigured()) return { error: AI_NOT_CONFIGURED };
  const workspace = await requireWorkspace();
  try {
    const result = await readReferenceDraft({ text: parsed.data.text, fileName: "pasted text" });
    return await storeReference(workspace, { ...result, deedType: parsed.data.deedType ?? result.deedType }, "upload");
  } catch (error) {
    return { error: error instanceof AiError ? error.message : "Could not read this text. Please try again." };
  }
}

async function storeReference(workspace: Awaited<ReturnType<typeof requireWorkspace>>, result: Awaited<ReturnType<typeof readReferenceDraft>>, source: "upload" | "finalized"): Promise<Result<{ item: MemoryItem }>> {
  const { data, error } = await workspace.supabase
    .from("ai_memory")
    .insert({ firm_id: workspace.firm.id, created_by: workspace.user.id, kind: "reference", deed_type: result.deedType, language: result.language, title: result.title, content: result.content, source })
    .select("*")
    .single();
  if (error || !data) return { error: error?.code === "42P01" || error?.code === "PGRST205" ? MIGRATION_HINT : (error?.message ?? "Could not save the reference.") };
  await workspace.supabase.from("activity_log").insert({ firm_id: workspace.firm.id, user_id: workspace.user.id, action: "ai_saved_reference", details: { ...usageDetails(result.usage), deed_type: result.deedType, language: result.language } });
  revalidatePath("/app/settings/ai");
  return { item: toItem(data as AiMemory) };
}

/** Keeps a finished draft from this app as a reference for future drafts (anonymised first). */
export async function saveDraftAsReference(input: unknown): Promise<Result> {
  const parsed = z.object({ deedId: z.string().uuid(), language: z.enum(["hindi", "english"]), text: z.string().trim().min(300).max(150000) }).safeParse(input);
  if (!parsed.success) return { error: "The draft is too short to keep as a reference." };
  if (!isAiConfigured()) return { error: AI_NOT_CONFIGURED };
  const workspace = await requireWorkspace();
  const { data: deed } = await workspace.supabase.from("deeds").select("id, deed_type, title").eq("id", parsed.data.deedId).eq("firm_id", workspace.firm.id).maybeSingle();
  if (!deed) return { error: "Deed not found." };
  try {
    const { content, usage } = await anonymiseDraft(parsed.data.text);
    const result = await storeReference(workspace, { deedType: deed.deed_type, language: parsed.data.language, title: "Accepted draft – " + new Date().toLocaleDateString("en-IN"), content, usage }, "finalized");
    return result.error !== undefined ? { error: result.error } : {};
  } catch (error) {
    return { error: error instanceof AiError ? error.message : "Could not save the reference. Please try again." };
  }
}

/** Studies the firm's references for one deed type and suggests style instructions to review. */
export async function learnStyle(input: unknown): Promise<Result<{ suggestions: string[] }>> {
  const parsed = z.object({ deedType }).safeParse(input);
  if (!parsed.success) return { error: "Choose a deed type." };
  if (!isAiConfigured()) return { error: AI_NOT_CONFIGURED };
  const workspace = await requireWorkspace();
  const memory = await loadFirmMemory(workspace);
  const firm = memory.references.filter((ref) => ref.deed_type === parsed.data.deedType).map((ref) => ref.content);
  const builtIn = (await builtInReferences()).filter((ref) => ref.deedType === parsed.data.deedType).map((ref) => ref.content);
  const sources = (firm.length ? firm : builtIn).slice(0, 4).map((content) => content.slice(0, 20000));
  if (!sources.length) return { error: "Add at least one accepted draft of this type first." };
  try {
    const { data, usage } = await generateJson<{ instructions?: unknown[] }>({
      system: stylePrompt(parsed.data.deedType),
      content: sources.map((content, index) => ({ text: "DRAFT " + (index + 1) + ":\n" + content })),
      schema: { type: "object", properties: { instructions: { type: "array", items: { type: "string" } } }, required: ["instructions"] },
      name: "save_style",
      description: "Save the firm's drafting style as instructions",
      maxTokens: 3000,
      temperature: 0.2,
      timeoutMs: 180_000,
    });
    await workspace.supabase.from("activity_log").insert({ firm_id: workspace.firm.id, user_id: workspace.user.id, action: "ai_learned_style", details: { ...usageDetails(usage), deed_type: parsed.data.deedType } });
    const suggestions = (data.instructions ?? []).filter((item): item is string => typeof item === "string" && item.trim() !== "").map((item) => item.trim().slice(0, 400)).slice(0, 15);
    return suggestions.length ? { suggestions } : { error: "No style instructions could be found." };
  } catch (error) {
    return { error: error instanceof AiError ? error.message : "Could not analyse the drafts. Please try again." };
  }
}
