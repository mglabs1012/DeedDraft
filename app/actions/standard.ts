"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { extractFromDocument, readDocumentText } from "@/app/actions/ai";
import { mergeExtraction } from "@/lib/ai/contract";
import { parseDeedData, sectionSchemas, standardWorkspaceSchema, type DeedData } from "@/lib/schemas/deed-data";
import { requireWorkspace } from "@/lib/workspace";
import type { Json } from "@/types/database";

type Result = { error: string; data?: never } | { error?: undefined; data: DeedData };

// Compare-and-swap protects ALL deed sections, including simultaneous manual edits.
// It uses the existing updated_at trigger; no new RPC or storage schema is required.
async function mutate(id: string, transform: (data: DeedData) => Partial<DeedData>): Promise<Result> {
  const workspace = await requireWorkspace();
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data: deed, error } = await workspace.supabase.from("deeds").select("data, updated_at")
      .eq("id", id).eq("firm_id", workspace.firm.id).maybeSingle();
    if (error || !deed) return { error: "Could not load this deed. Refresh and try again." };
    let patch: Partial<DeedData>;
    try { patch = transform(parseDeedData(deed.data)); }
    catch (error) { return { error: error instanceof Error ? error.message : "Could not save changes." }; }
    const next = { ...(deed.data as Record<string, Json>), ...patch } as Json;
    const { data: saved, error: saveError } = await workspace.supabase.from("deeds")
      .update({ data: next }).eq("id", id).eq("firm_id", workspace.firm.id).eq("updated_at", deed.updated_at)
      .select("data").maybeSingle();
    if (saveError) return { error: "Changes could not be saved. Please try again." };
    if (saved) {
      revalidatePath("/app/deeds/" + id);
      return { data: parseDeedData(saved.data) };
    }
  }
  return { error: "This deed is being edited elsewhere. Refresh before trying again." };
}

export async function saveStandardSection(input: unknown): Promise<Result> {
  const parsed = z.object({ id: z.string().uuid(), section: z.enum(["parties", "properties", "titleChain", "payments", "consideration", "terms", "execution"]), value: z.unknown(), expected: z.unknown() }).safeParse(input);
  if (!parsed.success) return { error: "Invalid section." };
  const { id, section, expected } = parsed.data;
  const value = sectionSchemas[section].safeParse(parsed.data.value);
  if (!value.success) return { error: value.error.issues[0]?.message ?? "Check the details." };
  return mutate(id, (current) => {
    if (JSON.stringify(current[section]) !== JSON.stringify(expected)) throw new Error("These details changed in another operation. Refresh and review before saving.");
    return { [section]: value.data };
  });
}

export async function toggleStandardModule(input: unknown): Promise<Result> {
  const parsed = z.object({ id: z.string().uuid(), module: z.enum(["naksha", "consideration"]), enabled: z.boolean() }).safeParse(input);
  if (!parsed.success) return { error: "Invalid module." };
  return mutate(parsed.data.id, (data) => ({
    workspace: standardWorkspaceSchema.parse({ ...data.workspace, modules: { ...data.workspace.modules, [parsed.data.module]: parsed.data.enabled } }),
  }));
}

export async function assignDocumentRoles(input: unknown): Promise<Result> {
  const parsed = z.object({ id: z.string().uuid(), documentIds: z.array(z.string().uuid()).max(30), role: z.enum(["first", "second", "witness", "other"]) }).safeParse(input);
  if (!parsed.success) return { error: "Invalid document role." };
  const workspace = await requireWorkspace();
  const { data: docs, error } = await workspace.supabase.from("deed_documents").select("id").eq("firm_id", workspace.firm.id).eq("deed_id", parsed.data.id).in("id", parsed.data.documentIds);
  if (error || docs?.length !== parsed.data.documentIds.length) return { error: "Some uploaded documents could not be found." };
  return mutate(parsed.data.id, (data) => ({ workspace: {
    ...data.workspace,
    documentRoles: { ...data.workspace.documentRoles, ...Object.fromEntries(parsed.data.documentIds.map((id) => [id, parsed.data.role])) },
  } }));
}

export async function processStandardDocument(input: unknown): Promise<Result & { warnings?: string[] }> {
  const parsed = z.object({ deedId: z.string().uuid(), documentId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { error: "Invalid document." };
  const workspace = await requireWorkspace();
  const { data: deed } = await workspace.supabase.from("deeds").select("data").eq("id", parsed.data.deedId).eq("firm_id", workspace.firm.id).maybeSingle();
  if (!deed) return { error: "Deed not found." };
  const { data: sourceDocument } = await workspace.supabase.from("deed_documents").select("category").eq("id", parsed.data.documentId).eq("deed_id", parsed.data.deedId).eq("firm_id", workspace.firm.id).maybeSingle();
  if (!sourceDocument) return { error: "Document not found." };
  if (parseDeedData(deed.data).workspace.processedDocuments.includes(parsed.data.documentId)) return { data: parseDeedData(deed.data) };
  const extracted = await extractFromDocument(parsed.data);
  if (extracted.error !== undefined) return { error: extracted.error };
  const result = await mutate(parsed.data.deedId, (current) => {
    if (current.workspace.processedDocuments.includes(parsed.data.documentId)) return {};
    const merged = mergeExtraction(current, {
      parties: extracted.extraction.parties.map((party) => ({
        ...party,
        // A dedicated person's upload window establishes the role of identity proofs.
        // Property papers retain the extraction's title-history interpretation.
        role: sourceDocument.category === "id_proof" && current.workspace.documentRoles[parsed.data.documentId] && current.workspace.documentRoles[parsed.data.documentId] !== "other"
          ? current.workspace.documentRoles[parsed.data.documentId] : party.role,
        documentIds: [parsed.data.documentId],
      })),
      properties: extracted.extraction.properties, titleChain: extracted.extraction.titleChain,
      payments: extracted.extraction.payments, consideration: extracted.extraction.consideration,
    });
    return {
      parties: merged.parties, properties: merged.properties, titleChain: merged.titleChain,
      payments: merged.payments, consideration: merged.consideration,
      workspace: { ...current.workspace, processedDocuments: [...current.workspace.processedDocuments, parsed.data.documentId].slice(-500) },
    };
  });
  return { ...result, warnings: extracted.extraction.warnings };
}

/** Read cached OCR on demand; source text never needs to travel in the initial page. */
export async function standardSourceText(input: unknown) {
  return readDocumentText(input);
}
