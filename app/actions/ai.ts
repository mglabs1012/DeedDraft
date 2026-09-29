"use server";

import { z } from "zod";

import { AiError, aiModel, chatCompletion, fallbackModels, isAiConfigured, keyStatus, pdfEngine, type AiUsage, type KeyStatus } from "@/lib/ai/openrouter";
import { normaliseClauses, normaliseExtraction, normaliseReview, parseJsonResponse, type Extraction, type ReviewIssue } from "@/lib/ai/parse";
import { clausePrompt, draftChatPrompt, draftReviewPrompt, extractionFromTextPrompt, reviewPrompt } from "@/lib/ai/prompts";
import { getReadiness } from "@/lib/drafting";
import { draftForAi, editableDraftSchema, validOperations, type EditOperation } from "@/lib/drafting/editable";
import { readDocument, type ReadResult } from "@/lib/ocr/read";
import { parseDeedData, type DeedData } from "@/lib/schemas/deed-data";
import { requireWorkspace } from "@/lib/workspace";
import type { Json } from "@/types/database";

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_TEXT_FOR_EXTRACTION = 60_000;
const NOT_CONFIGURED = "AI is not configured. Add OPENROUTER_API_KEY to the environment.";

type Result<T> = { error: string } | ({ error?: undefined } & T);
type Workspace = Awaited<ReturnType<typeof requireWorkspace>>;

async function loadDeed(deedId: string) {
  const workspace = await requireWorkspace();
  const { data: deed } = await workspace.supabase.from("deeds").select("*").eq("id", deedId).eq("firm_id", workspace.firm.id).maybeSingle();
  return { workspace, deed };
}

async function logUsage(workspace: Workspace, deedId: string | null, action: string, usage: AiUsage, extra: Record<string, Json> = {}) {
  await workspace.supabase.from("activity_log").insert({
    firm_id: workspace.firm.id,
    deed_id: deedId,
    user_id: workspace.user.id,
    action,
    details: { model: usage.model, prompt_tokens: usage.promptTokens ?? null, completion_tokens: usage.completionTokens ?? null, cost: usage.cost ?? null, ...extra },
  });
}

async function remember(workspace: Workspace, deedId: string, role: "user" | "assistant", content: string, meta: Record<string, Json> = {}) {
  // Chat history is best-effort: missing table (migration 0004 not applied) must not break the chat.
  await workspace.supabase.from("deed_ai_messages").insert({ deed_id: deedId, firm_id: workspace.firm.id, user_id: workspace.user.id, role, content: content.slice(0, 20_000), meta });
}

function failure(error: unknown): { error: string } {
  if (error instanceof AiError) return { error: error.message };
  if (error instanceof Error && error.message.includes("JSON")) return { error: "The AI response could not be read. Please try again." };
  console.error("AI action failed", error);
  return { error: "The AI request failed. Please try again." };
}

/** Removes identity numbers before matter data leaves the server for drafting/review. */
function redact(data: DeedData) {
  const { version: _version, ...rest } = data;
  void _version;
  return {
    ...rest,
    parties: data.parties.map(({ aadhaar, pan, phone, email, ...party }) => ({ ...party, hasAadhaar: Boolean(aadhaar), hasPan: Boolean(pan), hasContact: Boolean(phone || email) })),
  };
}

/* ---------------------------------------------------------- Read (OCR) */

type DocumentText = { text: string; source: string; quality: string; pages: number | null; cached: boolean };

async function documentText(workspace: Workspace, deedId: string, documentId: string, force: boolean): Promise<DocumentText> {
  const { data: document } = await workspace.supabase.from("deed_documents").select("*").eq("id", documentId).eq("deed_id", deedId).eq("firm_id", workspace.firm.id).maybeSingle();
  if (!document) throw new AiError("Document not found.");
  if (!force && document.extracted_text && document.text_source) {
    return { text: document.extracted_text, source: document.text_source, quality: document.text_quality ?? "good", pages: document.page_count ?? null, cached: true };
  }
  if (document.size_bytes > MAX_FILE_BYTES) throw new AiError("Files over 15 MB cannot be read. Upload a smaller scan (300 dpi, greyscale).");

  const { data: blob, error } = await workspace.supabase.storage.from("deed-documents").download(document.storage_path);
  if (error || !blob) throw new AiError("Could not read the document from storage.");

  const result: ReadResult = await readDocument({ bytes: new Uint8Array(await blob.arrayBuffer()), mime: document.mime_type, fileName: document.file_name, allowAi: isAiConfigured() });
  if (result.usage) await logUsage(workspace, deedId, "ai_read_document", result.usage, { file_name: document.file_name, pages: result.pages ?? null });

  // Cache the text (ignored if migration 0004 has not been applied yet).
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
    return await documentText(workspace, deed.id, parsed.data.documentId, parsed.data.force ?? false);
  } catch (error) {
    return failure(error);
  }
}

/* ------------------------------------------------------------ Extraction */

export async function extractFromDocument(input: unknown): Promise<Result<{ extraction: Extraction; source: string }>> {
  const parsed = readSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid request." };
  if (!isAiConfigured()) return { error: NOT_CONFIGURED };
  const { workspace, deed } = await loadDeed(parsed.data.deedId);
  if (!deed) return { error: "Deed not found." };

  try {
    const read = await documentText(workspace, deed.id, parsed.data.documentId, parsed.data.force ?? false);
    if (read.text.replace(/\s+/g, "").length < 40) return { error: "No readable text was found in this document. Re-scan it at 300 dpi or upload a clearer photo." };
    const { data: document } = await workspace.supabase.from("deed_documents").select("category, file_name").eq("id", parsed.data.documentId).maybeSingle();
    const { text, usage } = await chatCompletion({
      model: aiModel("extraction"),
      json: true,
      maxTokens: 8000,
      temperature: 0,
      messages: [
        { role: "system", content: extractionFromTextPrompt(deed.deed_type, document?.category ?? "other") },
        { role: "user", content: "Document: " + (document?.file_name ?? "") + "\n\n" + read.text.slice(0, MAX_TEXT_FOR_EXTRACTION) },
      ],
    });
    const extraction = normaliseExtraction(parseJsonResponse(text));
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
  if (!isAiConfigured()) return { error: NOT_CONFIGURED };
  const { workspace, deed } = await loadDeed(parsed.data.deedId);
  if (!deed) return { error: "Deed not found." };
  try {
    const { text, usage } = await chatCompletion({
      json: true,
      temperature: 0.3,
      messages: [
        { role: "system", content: clausePrompt(deed.deed_type, parsed.data.language) },
        { role: "user", content: JSON.stringify({ instructions: parsed.data.instructions, clientRemarks: deed.remarks ?? "", matter: redact(parseDeedData(deed.data)) }) },
      ],
    });
    const clauses = normaliseClauses(parseJsonResponse(text));
    if (!clauses.length) return { error: "The AI did not return any clauses. Try more specific instructions." };
    await logUsage(workspace, deed.id, "ai_drafted_clauses", usage, { count: clauses.length });
    return { clauses };
  } catch (error) {
    return failure(error);
  }
}

/* ------------------------------------------------------- Matter review */

export async function reviewDeed(input: unknown): Promise<Result<{ issues: ReviewIssue[] }>> {
  const parsed = z.object({ deedId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { error: "Invalid request." };
  if (!isAiConfigured()) return { error: NOT_CONFIGURED };
  const { workspace, deed } = await loadDeed(parsed.data.deedId);
  if (!deed) return { error: "Deed not found." };
  const data = parseDeedData(deed.data);
  const { count: documentCount } = await workspace.supabase.from("deed_documents").select("id", { count: "exact", head: true }).eq("deed_id", deed.id);
  try {
    const { text, usage } = await chatCompletion({
      json: true,
      temperature: 0,
      messages: [
        { role: "system", content: reviewPrompt(deed.deed_type) },
        {
          role: "user",
          content: JSON.stringify({
            deedType: deed.deed_type,
            draftLanguage: deed.language,
            clientRemarks: deed.remarks ?? "",
            uploadedDocuments: documentCount ?? 0,
            checklist: getReadiness(deed.deed_type, data, documentCount ?? 0).filter((item) => !item.done).map((item) => item.label),
            matter: redact(data),
          }),
        },
      ],
    });
    const issues = normaliseReview(parseJsonResponse(text));
    await logUsage(workspace, deed.id, "ai_reviewed_deed", usage, { issues: issues.length });
    return { issues };
  } catch (error) {
    return failure(error);
  }
}

/* ------------------------------------------------ Draft chat and review */

const chatSchema = z.object({
  deedId: z.string().uuid(),
  draft: editableDraftSchema,
  message: z.string().trim().min(2, "Type an instruction.").max(4000),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) })).max(12).default([]),
});

export async function chatEditDraft(input: unknown): Promise<Result<{ reply: string; operations: EditOperation[] }>> {
  const parsed = chatSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid request." };
  if (!isAiConfigured()) return { error: NOT_CONFIGURED };
  const { workspace, deed } = await loadDeed(parsed.data.deedId);
  if (!deed) return { error: "Deed not found." };
  const { draft, message, history } = parsed.data;

  try {
    const { text, usage } = await chatCompletion({
      json: true,
      temperature: 0.2,
      maxTokens: 8000,
      messages: [
        { role: "system", content: draftChatPrompt(deed.deed_type, draft.language) },
        { role: "user", content: "MATTER DATA (identity numbers removed):\n" + JSON.stringify(redact(parseDeedData(deed.data))) + "\n\nCLIENT REMARKS:\n" + (deed.remarks ?? "") + "\n\nCURRENT DRAFT:\n" + draftForAi(draft) },
        ...history.map((turn) => ({ role: turn.role, content: turn.content })),
        { role: "user", content: message },
      ],
    });
    const raw = parseJsonResponse(text) as { reply?: unknown; operations?: unknown };
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
  if (!isAiConfigured()) return { error: NOT_CONFIGURED };
  const { workspace, deed } = await loadDeed(parsed.data.deedId);
  if (!deed) return { error: "Deed not found." };
  try {
    const { text, usage } = await chatCompletion({
      json: true,
      temperature: 0,
      maxTokens: 6000,
      messages: [
        { role: "system", content: draftReviewPrompt(deed.deed_type) },
        { role: "user", content: "MATTER DATA:\n" + JSON.stringify(redact(parseDeedData(deed.data))) + "\n\nDRAFT:\n" + draftForAi(parsed.data.draft) },
      ],
    });
    const issues = normaliseReview(parseJsonResponse(text));
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
  model: string;
  extractionModel: string;
  fallbacks: string[];
  pdfEngine: string;
  key?: KeyStatus;
  keyError?: string;
  ping?: { ok: boolean; latencyMs?: number; servedBy?: string; error?: string };
};

export async function testAiConnection(): Promise<AiDiagnostics> {
  await requireWorkspace();
  const result: AiDiagnostics = { configured: isAiConfigured(), model: aiModel(), extractionModel: aiModel("extraction"), fallbacks: fallbackModels(), pdfEngine: pdfEngine() ?? "OpenRouter default" };
  if (!result.configured) return result;
  try {
    result.key = await keyStatus();
  } catch (error) {
    result.keyError = error instanceof Error ? error.message : "Could not read key status.";
  }
  const started = Date.now();
  try {
    const { usage } = await chatCompletion({ messages: [{ role: "user", content: "Reply with the single word OK." }], maxTokens: 5, retries: 0, timeoutMs: 30_000 });
    result.ping = { ok: true, latencyMs: Date.now() - started, servedBy: usage.model };
  } catch (error) {
    result.ping = { ok: false, error: error instanceof Error ? error.message : "Request failed." };
  }
  return result;
}
