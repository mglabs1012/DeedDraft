"use server";

import { z } from "zod";

import { AI_NOT_CONFIGURED, AiError, MAX_DOCUMENTS_PER_REQUEST, aiModel, fileBlocks, generateJson, isAiConfigured, usageDetails, type AiUsage, type ContentPart } from "@/lib/ai/claude";
import { draftingContext } from "@/lib/ai/memory.server";
import { identityWarnings, normaliseClauses, normaliseExtraction, normaliseParty, normaliseProperty, normaliseReview, type Extraction, type ReviewIssue } from "@/lib/ai/parse";
import { clausePrompt, extractionPrompt, partyDocsPrompt, propertyDocsPrompt, reviewPrompt } from "@/lib/ai/prompts";
import { relevantFacts } from "@/lib/ai/facts";
import { getDeedType, type DeedType } from "@/lib/deed-types";
import { getReadiness } from "@/lib/drafting";
import { parseDeedData, type DeedData, type Party, type Property } from "@/lib/schemas/deed-data";
import { requireWorkspace } from "@/lib/workspace";
import type { Json } from "@/types/database";

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_TOTAL_BYTES = 25 * 1024 * 1024;
const TOO_MANY_PAGES = "These papers are too large to read in one go (Bedrock reads at most 5 PDF parts of 4.5 MB each). Upload fewer pages or a lower-resolution scan.";

const documentCount = (blocks: ContentPart[]) => blocks.filter((block) => block.document !== undefined).length;

type Result<T> = { error: string } | ({ error?: undefined } & T);

/* Structured-output schemas: the model must return exactly these shapes (contents are still normalised and validated). */
const looseList = { type: "array", items: { type: "object" } };
const extractionSchema = {
  type: "object",
  properties: { summary: { type: "string" }, parties: looseList, properties: looseList, titleChain: looseList, consideration: { type: "object" }, payments: looseList, warnings: { type: "array", items: { type: "string" } } },
  required: ["summary", "parties", "properties", "titleChain", "payments", "warnings"],
};
const clausesSchema = { type: "object", properties: { clauses: { type: "array", items: { type: "string" } } }, required: ["clauses"] };
const reviewSchema = {
  type: "object",
  properties: { issues: { type: "array", items: { type: "object", properties: { severity: { type: "string", enum: ["high", "medium", "low"] }, section: { type: "string" }, message: { type: "string" } }, required: ["severity", "section", "message"] } } },
  required: ["issues"],
};
const autofillReplySchema = (target: "party" | "property") => ({
  type: "object",
  properties: { summary: { type: "string" }, [target]: { type: "object" }, warnings: { type: "array", items: { type: "string" } } },
  required: ["summary", target, "warnings"],
});

async function loadDeed(deedId: string) {
  const workspace = await requireWorkspace();
  const { data: deed } = await workspace.supabase
    .from("deeds")
    .select("*")
    .eq("id", deedId)
    .eq("firm_id", workspace.firm.id)
    .maybeSingle();
  return { workspace, deed };
}

async function logUsage(workspace: Awaited<ReturnType<typeof requireWorkspace>>, deedId: string, action: string, usage: AiUsage, extra: Record<string, Json> = {}) {
  await workspace.supabase.from("activity_log").insert({
    firm_id: workspace.firm.id,
    deed_id: deedId,
    user_id: workspace.user.id,
    action,
    details: { ...usageDetails(usage), ...extra },
  });
}

function failure(error: unknown): { error: string } {
  if (error instanceof AiError) return { error: error.message };
  if (error instanceof Error && error.message.includes("JSON")) return { error: "The AI response could not be read. Please try again." };
  console.error("AI action failed", error);
  return { error: "The AI request failed. Please try again." };
}

/** Removes identity numbers before matter data leaves the server for drafting/review. */
function redact(data: DeedData, type: DeedType) {
  return {
    ...relevantFacts(type, data),
    parties: data.parties.map(({ aadhaar, pan, phone, email, ...party }) => ({
      ...party,
      hasAadhaar: Boolean(aadhaar),
      hasPan: Boolean(pan),
      hasContact: Boolean(phone || email),
    })),
  };
}

/* ------------------------------------------------------------ Extraction */

const extractSchema = z.object({ deedId: z.string().uuid(), documentId: z.string().uuid() });

export async function extractFromDocument(input: unknown): Promise<Result<{ extraction: Extraction }>> {
  const parsed = extractSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid request." };
  if (!isAiConfigured()) return { error: AI_NOT_CONFIGURED };

  const { workspace, deed } = await loadDeed(parsed.data.deedId);
  if (!deed) return { error: "Deed not found." };

  const { data: document } = await workspace.supabase
    .from("deed_documents")
    .select("*")
    .eq("id", parsed.data.documentId)
    .eq("deed_id", deed.id)
    .eq("firm_id", workspace.firm.id)
    .maybeSingle();
  if (!document) return { error: "Document not found." };
  if (document.size_bytes > MAX_FILE_BYTES) return { error: "AI extraction supports files up to 20 MB. Upload a smaller scan." };

  const { data: blob, error: downloadError } = await workspace.supabase.storage.from("deed-documents").download(document.storage_path);
  if (downloadError || !blob) return { error: "Could not read the document from storage." };

  try {
    const blocks = await fileBlocks(document.mime_type, new Uint8Array(await blob.arrayBuffer()), document.file_name);
    if (documentCount(blocks) > MAX_DOCUMENTS_PER_REQUEST) return { error: TOO_MANY_PAGES };
    const { data: raw, usage } = await generateJson({
      model: aiModel("extraction"),
      system: extractionPrompt(deed.deed_type, document.category),
      content: [...blocks, { text: "Extract the particulars from this document: " + document.file_name }],
      schema: extractionSchema,
      name: "save_extraction",
      description: "Save the particulars read from the document",
      maxTokens: 12000,
      temperature: 0,
      timeoutMs: 200_000,
    });
    const extraction = normaliseExtraction(raw);
    await logUsage(workspace, deed.id, "ai_extracted_document", usage, { file_name: document.file_name });
    return { extraction };
  } catch (error) {
    return failure(error);
  }
}

/* --------------------------------------------------------------- Clauses */

const clauseSchema = z.object({
  deedId: z.string().uuid(),
  instructions: z.string().trim().min(5, "Describe what the clauses should cover.").max(3000),
  language: z.enum(["hindi", "english"]),
});

export async function draftClauses(input: unknown): Promise<Result<{ clauses: string[] }>> {
  const parsed = clauseSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid request." };
  if (!isAiConfigured()) return { error: AI_NOT_CONFIGURED };

  const { workspace, deed } = await loadDeed(parsed.data.deedId);
  if (!deed) return { error: "Deed not found." };

  try {
    const memory = await draftingContext(workspace, deed.deed_type, parsed.data.language);
    const { data: raw, usage } = await generateJson({
      system: clausePrompt(deed.deed_type, parsed.data.language),
      cachedContext: memory.text || undefined,
      content: JSON.stringify({ instructions: parsed.data.instructions, clientRemarks: deed.remarks ?? "", matter: redact(parseDeedData(deed.data), deed.deed_type) }),
      schema: clausesSchema,
      name: "save_clauses",
      description: "Save the drafted clauses",
      temperature: 0.3,
    });
    const clauses = normaliseClauses(raw);
    if (!clauses.length) return { error: "The AI did not return any clauses. Try more specific instructions." };
    await logUsage(workspace, deed.id, "ai_drafted_clauses", usage, { count: clauses.length });
    return { clauses };
  } catch (error) {
    return failure(error);
  }
}

/* ---------------------------------------------------------------- Review */

export async function reviewDeed(input: unknown): Promise<Result<{ issues: ReviewIssue[] }>> {
  const parsed = z.object({ deedId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { error: "Invalid request." };
  if (!isAiConfigured()) return { error: AI_NOT_CONFIGURED };

  const { workspace, deed } = await loadDeed(parsed.data.deedId);
  if (!deed) return { error: "Deed not found." };

  const data = parseDeedData(deed.data);
  const { count: documentCount } = await workspace.supabase.from("deed_documents").select("id", { count: "exact", head: true }).eq("deed_id", deed.id);

  try {
    const memory = await draftingContext(workspace, deed.deed_type, deed.language === "english" ? "english" : "hindi", { references: false });
    const { data: raw, usage } = await generateJson({
      temperature: 0,
      system: reviewPrompt(deed.deed_type),
      cachedContext: memory.text || undefined,
      schema: reviewSchema,
      name: "save_review",
      description: "Save the review findings",
      content: JSON.stringify({
        deedType: deed.deed_type,
        draftLanguage: deed.language,
        clientRemarks: deed.remarks ?? "",
        uploadedDocuments: documentCount ?? 0,
        checklist: getReadiness(deed.deed_type, data, documentCount ?? 0).filter((item) => !item.done).map((item) => item.label),
        matter: redact(data, deed.deed_type),
      }),
    });
    const issues = normaliseReview(raw);
    await logUsage(workspace, deed.id, "ai_reviewed_deed", usage, { issues: issues.length });
    return { issues };
  } catch (error) {
    return failure(error);
  }
}

/* ------------------------------------------- Autofill a form from papers */

const autofillSchema = z.object({
  deedId: z.string().uuid(),
  documentIds: z.array(z.string().uuid()).min(1, "Upload at least one document.").max(5, "Use up to 5 files at a time."),
  target: z.enum(["party", "property"]),
  role: z.enum(["first", "second", "witness", "other"]).optional(),
});

export type AutofillResult = {
  summary: string;
  warnings: string[];
  party?: Omit<Party, "id" | "role">;
  property?: Omit<Property, "id">;
};

/**
 * Reads identity papers (Aadhaar, PAN…) into one party, or a naksha / layout
 * plan / patta / jamabandi into one property. Nothing is saved here: the
 * advocate reviews the filled form before saving it.
 */
export async function autofillFromDocuments(input: unknown): Promise<Result<{ result: AutofillResult }>> {
  const parsed = autofillSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid request." };
  if (!isAiConfigured()) return { error: AI_NOT_CONFIGURED };

  const { workspace, deed } = await loadDeed(parsed.data.deedId);
  if (!deed) return { error: "Deed not found." };

  const { data: documents } = await workspace.supabase
    .from("deed_documents")
    .select("*")
    .in("id", parsed.data.documentIds)
    .eq("deed_id", deed.id)
    .eq("firm_id", workspace.firm.id);
  if (!documents?.length) return { error: "Documents not found." };
  if (documents.some((document) => document.size_bytes > MAX_FILE_BYTES)) return { error: "AI reading supports files up to 20 MB each. Upload a smaller scan." };
  if (documents.reduce((sum, document) => sum + document.size_bytes, 0) > MAX_TOTAL_BYTES) return { error: "These files are too large together. Use fewer or smaller scans." };

  const isParty = parsed.data.target === "party";
  const roleLabel = getDeedType(deed.deed_type).roles[parsed.data.role ?? "first"].en;

  try {
    const content: ContentPart[] = [];
    for (const document of documents) {
      const { data: blob, error } = await workspace.supabase.storage.from("deed-documents").download(document.storage_path);
      if (error || !blob) return { error: "Could not read " + document.file_name + " from storage." };
      content.push({ text: "File: " + document.file_name });
      content.push(...(await fileBlocks(document.mime_type, new Uint8Array(await blob.arrayBuffer()), document.file_name)));
    }
    if (documentCount(content) > MAX_DOCUMENTS_PER_REQUEST) return { error: TOO_MANY_PAGES };
    content.push({ text: isParty ? "Fill in this person's details." : "Fill in this property's details." });

    const { data: raw, usage } = await generateJson<Record<string, unknown>>({
      model: aiModel("extraction"),
      system: isParty ? partyDocsPrompt(deed.deed_type, roleLabel) : propertyDocsPrompt(deed.deed_type),
      content,
      schema: autofillReplySchema(isParty ? "party" : "property"),
      name: "save_details",
      description: isParty ? "Save the person’s details" : "Save the property details",
      maxTokens: 6000,
      temperature: 0,
      timeoutMs: 180_000,
    });
    const summary = typeof raw.summary === "string" ? raw.summary.slice(0, 500) : "";
    const warnings = (Array.isArray(raw.warnings) ? raw.warnings : []).filter((item): item is string => typeof item === "string").slice(0, 10);
    const item = (raw[isParty ? "party" : "property"] ?? {}) as Record<string, unknown>;
    const result: AutofillResult = { summary, warnings };

    if (isParty) {
      const party = normaliseParty({ ...item, role: parsed.data.role ?? "first" });
      if (!party) return { error: "No name could be read from these documents. Try a clearer scan." };
      const { id: _id, role: _role, ...rest } = party;
      void _id;
      void _role;
      result.party = rest;
      result.warnings = [...identityWarnings([party]), ...result.warnings].slice(0, 10);
    } else {
      const property = normaliseProperty(item);
      if (!property) return { error: "No property details could be read from these documents." };
      const { id: _id, ...rest } = property;
      void _id;
      result.property = rest;
    }

    await logUsage(workspace, deed.id, isParty ? "ai_filled_party" : "ai_filled_property", usage, { files: documents.length });
    return { result };
  } catch (error) {
    return failure(error);
  }
}
