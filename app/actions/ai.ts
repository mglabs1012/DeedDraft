"use server";

import { z } from "zod";

import { AI_NOT_CONFIGURED, AiError, MAX_DOCUMENTS_PER_REQUEST, aiModel, fileBlocks, generate, generateJson, isAiConfigured, usageDetails, type AiUsage, type ContentPart } from "@/lib/ai/claude";
import { aiAllowance } from "@/lib/ai/guard.server";
import { draftingContext } from "@/lib/ai/memory.server";
import { identityWarnings, normaliseClauses, normaliseExtraction, normaliseParty, normaliseProperty, normaliseReview, type Extraction, type ReviewIssue } from "@/lib/ai/parse";
import { clausePrompt, draftChatPrompt, draftReviewPrompt, extractionFromTextPrompt, partyDocsPrompt, propertyDocsPrompt, reviewPrompt } from "@/lib/ai/prompts";
import { relevantFacts } from "@/lib/ai/facts";
import { getDeedType, type DeedType } from "@/lib/deed-types";
import { getReadiness } from "@/lib/drafting";
import { draftForAi, editableDraftSchema, validOperations, type EditOperation } from "@/lib/drafting/editable";
import { readDocument, type ReadResult } from "@/lib/ocr/read";
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

const MAX_TEXT_FOR_EXTRACTION = 60_000;

type Workspace = Awaited<ReturnType<typeof requireWorkspace>>;
type DocumentText = { text: string; source: string; quality: string; pages: number | null; cached: boolean };

/** Chat history for audit (table from migration 202609290004). Best-effort: a missing table never breaks the chat. */
async function remember(workspace: Workspace, deedId: string, role: "user" | "assistant", content: string, meta: Record<string, Json> = {}) {
  await workspace.supabase.from("deed_ai_messages").insert({ deed_id: deedId, firm_id: workspace.firm.id, user_id: workspace.user.id, role, content: content.slice(0, 20_000), meta });
}

/**
 * A document's text, read once and cached on the document row: PDF text layer
 * (with Kruti Dev conversion) or Word text for free, AI OCR on Bedrock only for
 * scans and garbled pages.
 */
async function documentText(workspace: Workspace, deedId: string, documentId: string, force: boolean, checkAllowance = false): Promise<DocumentText> {
  const { data: document } = await workspace.supabase.from("deed_documents").select("*").eq("id", documentId).eq("deed_id", deedId).eq("firm_id", workspace.firm.id).maybeSingle();
  if (!document) throw new AiError("Document not found.");
  if (!force && document.extracted_text && document.text_source) {
    return { text: document.extracted_text, source: document.text_source, quality: document.text_quality ?? "good", pages: document.page_count ?? null, cached: true };
  }
  if (document.size_bytes > MAX_FILE_BYTES) throw new AiError("Files over 20 MB cannot be read. Upload a smaller scan (300 dpi, greyscale).");

  const { data: blob, error } = await workspace.supabase.storage.from("deed-documents").download(document.storage_path);
  if (error || !blob) throw new AiError("Could not read the document from storage.");

  // Text layers and Word files are read for free; AI OCR (scans) counts against the AI limit when called on its own.
  const blocked = checkAllowance && isAiConfigured() ? await aiAllowance(workspace) : null;
  let result: ReadResult;
  try {
    result = await readDocument({ bytes: new Uint8Array(await blob.arrayBuffer()), mime: document.mime_type, fileName: document.file_name, allowAi: isAiConfigured() && !blocked });
  } catch (error) {
    if (blocked) throw new AiError(blocked);
    throw error;
  }
  if (result.usage) await logUsage(workspace, deedId, "ai_read_document", result.usage, { file_name: document.file_name, pages: result.pages ?? null });

  // Cache the text (ignored if migration 202609290004 has not been applied yet).
  await workspace.supabase
    .from("deed_documents")
    .update({ extracted_text: result.text, text_source: result.source, text_quality: result.quality, page_count: result.pages, processed_at: new Date().toISOString() })
    .eq("id", document.id);

  return { text: result.text, source: result.source, quality: result.quality, pages: result.pages, cached: false };
}

const readSchema = z.object({ deedId: z.string().uuid(), documentId: z.string().uuid(), force: z.boolean().optional() });

export async function readDocumentText(input: unknown): Promise<Result<DocumentText>> {
  const parsed = readSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid request." };
  const { workspace, deed } = await loadDeed(parsed.data.deedId);
  if (!deed) return { error: "Deed not found." };
  try {
    return await documentText(workspace, deed.id, parsed.data.documentId, parsed.data.force ?? false, true);
  } catch (error) {
    return failure(error);
  }
}

export async function extractFromDocument(input: unknown): Promise<Result<{ extraction: Extraction; source: string }>> {
  const parsed = readSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid request." };
  if (!isAiConfigured()) return { error: AI_NOT_CONFIGURED };
  const { workspace, deed } = await loadDeed(parsed.data.deedId);
  if (!deed) return { error: "Deed not found." };
  const limited = await aiAllowance(workspace);
  if (limited) return { error: limited };

  try {
    const read = await documentText(workspace, deed.id, parsed.data.documentId, parsed.data.force ?? false);
    if (read.text.replace(/\s+/g, "").length < 40) return { error: "No readable text was found in this document. Re-scan it at 300 dpi or upload a clearer photo." };
    const { data: document } = await workspace.supabase.from("deed_documents").select("category, file_name").eq("id", parsed.data.documentId).maybeSingle();
    const { data: raw, usage } = await generateJson({
      model: aiModel("extraction"),
      system: extractionFromTextPrompt(deed.deed_type, document?.category ?? "other"),
      content: "Document: " + (document?.file_name ?? "") + "\n\n" + read.text.slice(0, MAX_TEXT_FOR_EXTRACTION),
      schema: extractionSchema,
      name: "save_extraction",
      description: "Save the particulars read from the document",
      maxTokens: 12000,
      temperature: 0,
      timeoutMs: 200_000,
    });
    const extraction = normaliseExtraction(raw);
    if (read.quality === "poor") extraction.warnings.unshift("The document text was hard to read; double-check every value.");
    await logUsage(workspace, deed.id, "ai_extracted_document", usage, { file_name: document?.file_name ?? "", text_source: read.source });
    return { extraction, source: read.source };
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
  const limited = await aiAllowance(workspace);
  if (limited) return { error: limited };

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
  const limited = await aiAllowance(workspace);
  if (limited) return { error: limited };

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
  const limited = await aiAllowance(workspace);
  if (limited) return { error: limited };

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

/* ------------------------------------------------ Draft studio: chat and review */

const chatSchema = z.object({
  deedId: z.string().uuid(),
  draft: editableDraftSchema,
  message: z.string().trim().min(2, "Type an instruction.").max(4000),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) })).max(12).default([]),
});

const chatReplySchema = {
  type: "object",
  properties: { reply: { type: "string" }, operations: { type: "array", items: { type: "object" }, description: "Proposed edits to the draft blocks" } },
  required: ["reply", "operations"],
};

export async function chatEditDraft(input: unknown): Promise<Result<{ reply: string; operations: EditOperation[] }>> {
  const parsed = chatSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid request." };
  if (!isAiConfigured()) return { error: AI_NOT_CONFIGURED };
  const { workspace, deed } = await loadDeed(parsed.data.deedId);
  if (!deed) return { error: "Deed not found." };
  const limited = await aiAllowance(workspace);
  if (limited) return { error: limited };
  const { draft, message, history } = parsed.data;

  try {
    const memory = await draftingContext(workspace, deed.deed_type, draft.language, { references: false });
    const turns = [...history, { role: "user" as const, content: message }];
    while (turns.length && turns[0].role !== "user") turns.shift();
    const { data: raw, usage } = await generateJson<{ reply?: unknown; operations?: unknown }>({
      system: draftChatPrompt(deed.deed_type, draft.language),
      cachedContext: [memory.text, "MATTER DATA (identity numbers removed):\n" + JSON.stringify(redact(parseDeedData(deed.data), deed.deed_type)), "CLIENT REMARKS:\n" + (deed.remarks ?? ""), "CURRENT DRAFT:\n" + draftForAi(draft)].filter(Boolean).join("\n\n"),
      content: turns.map((turn) => ({ role: turn.role, content: [{ text: turn.content }] })),
      schema: chatReplySchema,
      name: "propose_changes",
      description: "Reply and propose edits to the draft",
      maxTokens: 8000,
      temperature: 0.2,
    });
    const operations = validOperations(draft, Array.isArray(raw.operations) ? raw.operations : []);
    const reply = typeof raw.reply === "string" && raw.reply.trim() ? raw.reply.trim().slice(0, 4000) : operations.length ? "Proposed " + operations.length + " change(s)." : "No changes proposed.";
    await remember(workspace, deed.id, "user", message, { language: draft.language });
    await remember(workspace, deed.id, "assistant", reply, { operations: operations.length });
    await logUsage(workspace, deed.id, "ai_chat_draft", usage, { operations: operations.length });
    return { reply, operations };
  } catch (error) {
    return failure(error);
  }
}

export async function reviewDraftText(input: unknown): Promise<Result<{ issues: ReviewIssue[] }>> {
  const parsed = z.object({ deedId: z.string().uuid(), draft: editableDraftSchema }).safeParse(input);
  if (!parsed.success) return { error: "Invalid request." };
  if (!isAiConfigured()) return { error: AI_NOT_CONFIGURED };
  const { workspace, deed } = await loadDeed(parsed.data.deedId);
  if (!deed) return { error: "Deed not found." };
  const limited = await aiAllowance(workspace);
  if (limited) return { error: limited };
  try {
    const memory = await draftingContext(workspace, deed.deed_type, parsed.data.draft.language, { references: false });
    const { data: raw, usage } = await generateJson({
      system: draftReviewPrompt(deed.deed_type),
      cachedContext: memory.text || undefined,
      content: "MATTER DATA:\n" + JSON.stringify(redact(parseDeedData(deed.data), deed.deed_type)) + "\n\nDRAFT:\n" + draftForAi(parsed.data.draft),
      schema: reviewSchema,
      name: "save_review",
      description: "Save the review findings",
      maxTokens: 6000,
      temperature: 0,
    });
    const issues = normaliseReview(raw);
    await remember(workspace, deed.id, "assistant", "Reviewed the draft: " + issues.length + " issue(s).", { review: true });
    await logUsage(workspace, deed.id, "ai_reviewed_draft", usage, { issues: issues.length });
    return { issues };
  } catch (error) {
    return failure(error);
  }
}

/* ----------------------------------------------------------- Diagnostics */

export type AiDiagnostics = {
  configured: boolean;
  region: string;
  model: string;
  extractionModel: string;
  fastModel: string;
  ping?: { ok: boolean; latencyMs?: number; servedBy?: string; error?: string };
  fastPing?: { ok: boolean; latencyMs?: number; error?: string };
};

/** Settings → AI connection: shows the Bedrock setup and sends two tiny test requests. */
export async function testAiConnection(): Promise<AiDiagnostics> {
  await requireWorkspace();
  const result: AiDiagnostics = { configured: isAiConfigured(), region: process.env.AWS_REGION ?? "", model: aiModel(), extractionModel: aiModel("extraction"), fastModel: aiModel("fast") };
  if (!result.configured) return result;
  const ping = async (model: string) => {
    const started = Date.now();
    try {
      const { usage } = await generate({ system: "Reply with the single word OK.", content: "OK?", model, maxTokens: 5, temperature: 0, timeoutMs: 30_000 });
      return { ok: true, latencyMs: Date.now() - started, servedBy: usage.model };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Request failed." };
    }
  };
  result.ping = await ping(result.model);
  result.fastPing = result.fastModel === result.model ? result.ping : await ping(result.fastModel);
  return result;
}
