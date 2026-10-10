"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { AI_NOT_CONFIGURED, AiError, generateJson, isAiConfigured, usageDetails } from "@/lib/ai/claude";
import { draftingContext } from "@/lib/ai/memory.server";
import { saveDeedSection } from "@/lib/deed-sections.server";
import { templateDraftPrompt } from "@/lib/ai/prompts";
import { customDraftSchema, parseDeedData, type CustomDoc, type CustomDraft } from "@/lib/schemas/deed-data";
import { formFields, labelledAnswers } from "@/lib/templates/forms";
import { getLibraryEntry, getTemplateText } from "@/lib/templates/library.server";
import { requireWorkspace } from "@/lib/workspace";
import type { Json } from "@/types/database";

type Result<T = object> = { error: string } | ({ error?: undefined } & T);

const languageSchema = z.enum(["english", "hindi"]);

/** Template text for the library preview. */
export async function getTemplatePreview(input: unknown): Promise<Result<{ title: string; text: string }>> {
  const parsed = z.object({ id: z.string().max(120) }).safeParse(input);
  if (!parsed.success) return { error: "Unknown template." };
  await requireWorkspace();
  const entry = getLibraryEntry(parsed.data.id);
  const text = entry ? await getTemplateText(entry.id) : null;
  if (!entry || !text) return { error: "Template not found." };
  return { title: entry.title, text };
}

async function loadCustomDeed(id: string) {
  const workspace = await requireWorkspace();
  const { data: deed } = await workspace.supabase.from("deeds").select("*").eq("id", id).eq("firm_id", workspace.firm.id).maybeSingle();
  const data = deed ? parseDeedData(deed.data) : null;
  return { workspace, deed, data, custom: data?.custom ?? null };
}

/** Writes data.custom atomically (other sections, e.g. a running chat, are not overwritten). */
async function saveCustom(workspace: Awaited<ReturnType<typeof requireWorkspace>>, deedId: string, _data: ReturnType<typeof parseDeedData>, custom: CustomDoc, action: string, details: Record<string, Json> = {}) {
  const error = await saveDeedSection(workspace, deedId, "custom", custom);
  if (error) return error;
  await workspace.supabase.from("activity_log").insert({ firm_id: workspace.firm.id, deed_id: deedId, user_id: workspace.user.id, action, details });
  revalidatePath("/app/deeds/" + deedId);
  return null;
}

export async function saveCustomAnswers(input: unknown): Promise<Result> {
  const parsed = z.object({ id: z.string().uuid(), answers: z.record(z.string().max(6000)) }).safeParse(input);
  if (!parsed.success) return { error: "Some answers are too long." };
  const { workspace, deed, data, custom } = await loadCustomDeed(parsed.data.id);
  if (!deed || !data || !custom) return { error: "Document not found." };
  const entry = getLibraryEntry(custom.templateId);
  if (!entry) return { error: "This template is no longer available." };

  const allowed = new Set(formFields(entry).map((item) => item.key));
  const answers = Object.fromEntries(Object.entries(parsed.data.answers).filter(([key, value]) => allowed.has(key) && value.trim()).map(([key, value]) => [key, value.trim()]));
  const error = await saveCustom(workspace, deed.id, data, { ...custom, answers }, "updated_custom_details");
  return error ? { error } : {};
}

export async function saveCustomDraft(input: unknown): Promise<Result> {
  const parsed = z.object({ id: z.string().uuid(), language: languageSchema, draft: customDraftSchema }).safeParse(input);
  if (!parsed.success) return { error: "The draft is too long to save." };
  const { workspace, deed, data, custom } = await loadCustomDeed(parsed.data.id);
  if (!deed || !data || !custom) return { error: "Document not found." };
  const draft: CustomDraft = { ...parsed.data.draft, paragraphs: parsed.data.draft.paragraphs.map((item) => item.trim()).filter(Boolean), edited: true };
  const error = await saveCustom(workspace, deed.id, data, { ...custom, drafts: { ...custom.drafts, [parsed.data.language]: draft } }, "edited_custom_draft");
  return error ? { error } : {};
}

/** Fills the template with the form answers using Claude and saves the result. */
export async function draftFromTemplate(input: unknown): Promise<Result<{ draft: CustomDraft }>> {
  const parsed = z.object({ id: z.string().uuid(), language: languageSchema }).safeParse(input);
  if (!parsed.success) return { error: "Invalid request." };
  if (!isAiConfigured()) return { error: AI_NOT_CONFIGURED };
  const { workspace, deed, data, custom } = await loadCustomDeed(parsed.data.id);
  if (!deed || !data || !custom) return { error: "Document not found." };
  const entry = getLibraryEntry(custom.templateId);
  const text = entry ? await getTemplateText(entry.id) : null;
  if (!entry || !text) return { error: "This template is no longer available." };

  try {
    const memory = await draftingContext(workspace, "other", parsed.data.language, { references: false });
    const { data: raw, usage } = await generateJson<{ title?: unknown; paragraphs?: unknown }>({
      system: templateDraftPrompt({ title: entry.title, language: parsed.data.language, usFormat: Boolean(entry.us) }),
      cachedContext: memory.text || undefined,
      schema: { type: "object", properties: { title: { type: "string" }, paragraphs: { type: "array", items: { type: "string" } } }, required: ["title", "paragraphs"] },
      name: "save_document",
      description: "Save the finished document",
      content: [
        { text: "TEMPLATE:\n" + text },
        { text: "ANSWERS:\n" + (labelledAnswers(entry, custom.answers) || "(none given)") + (deed.remarks ? "\n\nEXTRA INSTRUCTIONS:\n" + deed.remarks : "") },
      ],
      maxTokens: 16000,
      temperature: 0.2,
      timeoutMs: 280_000,
    });
    const paragraphs = (Array.isArray(raw.paragraphs) ? raw.paragraphs : []).filter((item): item is string => typeof item === "string" && item.trim() !== "").map((item) => item.trim().slice(0, 12000)).slice(0, 600);
    if (!paragraphs.length) return { error: "The AI returned an empty draft. Please try again." };
    const draft: CustomDraft = { title: typeof raw.title === "string" && raw.title.trim() ? raw.title.trim().slice(0, 300) : entry.title, paragraphs, generatedAt: new Date().toISOString(), edited: false };

    const error = await saveCustom(workspace, deed.id, data, { ...custom, drafts: { ...custom.drafts, [parsed.data.language]: draft } }, "ai_drafted_document", {
      ...usageDetails(usage),
      template: entry.id,
      language: parsed.data.language,
    });
    return error ? { error } : { draft };
  } catch (error) {
    if (error instanceof AiError) return { error: error.message };
    if (error instanceof Error && error.message.includes("JSON")) return { error: "The AI response could not be read. Please try again." };
    console.error("Template drafting failed", error);
    return { error: "The AI request failed. Please try again." };
  }
}
