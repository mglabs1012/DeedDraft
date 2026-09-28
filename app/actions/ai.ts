"use server";

import { z } from "zod";

import { AiError, aiModel, chatCompletion, isAiConfigured, type AiUsage, type ContentPart } from "@/lib/ai/openrouter";
import { normaliseClauses, normaliseExtraction, normaliseReview, parseJsonResponse, type Extraction, type ReviewIssue } from "@/lib/ai/parse";
import { clausePrompt, extractionPrompt, reviewPrompt } from "@/lib/ai/prompts";
import { getReadiness } from "@/lib/drafting";
import { parseDeedData, type DeedData } from "@/lib/schemas/deed-data";
import { requireWorkspace } from "@/lib/workspace";
import type { Json } from "@/types/database";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

type Result<T> = { error: string } | ({ error?: undefined } & T);

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
    details: { model: usage.model, prompt_tokens: usage.promptTokens ?? null, completion_tokens: usage.completionTokens ?? null, cost: usage.cost ?? null, ...extra },
  });
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
  if (!isAiConfigured()) return { error: "AI is not configured. Add OPENROUTER_API_KEY to the environment." };

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
  if (document.size_bytes > MAX_FILE_BYTES) return { error: "AI extraction supports files up to 10 MB. Upload a smaller scan." };

  const { data: blob, error: downloadError } = await workspace.supabase.storage.from("deed-documents").download(document.storage_path);
  if (downloadError || !blob) return { error: "Could not read the document from storage." };

  const dataUrl = "data:" + document.mime_type + ";base64," + Buffer.from(await blob.arrayBuffer()).toString("base64");
  const filePart: ContentPart =
    document.mime_type === "application/pdf"
      ? { type: "file", file: { filename: document.file_name, file_data: dataUrl } }
      : { type: "image_url", image_url: { url: dataUrl } };

  try {
    const { text, usage } = await chatCompletion({
      model: aiModel("extraction"),
      json: true,
      maxTokens: 6000,
      temperature: 0,
      messages: [
        { role: "system", content: extractionPrompt(deed.deed_type, document.category) },
        { role: "user", content: [{ type: "text", text: "Extract the particulars from this document: " + document.file_name }, filePart] },
      ],
    });
    const extraction = normaliseExtraction(parseJsonResponse(text));
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
  if (!isAiConfigured()) return { error: "AI is not configured. Add OPENROUTER_API_KEY to the environment." };

  const { workspace, deed } = await loadDeed(parsed.data.deedId);
  if (!deed) return { error: "Deed not found." };

  try {
    const { text, usage } = await chatCompletion({
      json: true,
      temperature: 0.3,
      messages: [
        { role: "system", content: clausePrompt(deed.deed_type, parsed.data.language) },
        {
          role: "user",
          content: JSON.stringify({ instructions: parsed.data.instructions, clientRemarks: deed.remarks ?? "", matter: redact(parseDeedData(deed.data)) }),
        },
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

/* ---------------------------------------------------------------- Review */

export async function reviewDeed(input: unknown): Promise<Result<{ issues: ReviewIssue[] }>> {
  const parsed = z.object({ deedId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { error: "Invalid request." };
  if (!isAiConfigured()) return { error: "AI is not configured. Add OPENROUTER_API_KEY to the environment." };

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
