"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { AI_NOT_CONFIGURED, AiError, generateJson, isAiConfigured, usageDetails } from "@/lib/ai/claude";
import { draftingContext } from "@/lib/ai/memory.server";
import { refinePrompt } from "@/lib/ai/prompts";
import { createRedactor } from "@/lib/ai/redact";
import { saveDeedSection } from "@/lib/deed-sections.server";
import { buildDraftDocuments } from "@/lib/drafting";
import { localizeData } from "@/lib/drafting/localize";
import { blockSegments, draftOutline, hashSegments, keepsParticulars, keepsTerms, protectedTerms } from "@/lib/drafting/segments";
import { parseDeedData, type AiDraftVersion, type AiEdit } from "@/lib/schemas/deed-data";
import { requireWorkspace } from "@/lib/workspace";

type Result<T = object> = { error: string } | ({ error?: undefined } & T);

const editsSchema = {
  type: "object",
  properties: {
    edits: {
      type: "array",
      items: {
        type: "object",
        properties: {
          op: { type: "string", enum: ["replace", "insert_after", "delete"] },
          index: { type: "integer", description: "Segment number" },
          text: { type: "string", description: "Full new text for replace / insert_after" },
        },
        required: ["op", "index"],
      },
    },
    notes: { type: "array", items: { type: "string" }, description: "Short notes for the user about the changes" },
  },
  required: ["edits", "notes"],
};

async function loadDeed(deedId: string) {
  const workspace = await requireWorkspace();
  const { data: deed } = await workspace.supabase.from("deeds").select("*").eq("id", deedId).eq("firm_id", workspace.firm.id).maybeSingle();
  return { workspace, deed, data: deed ? parseDeedData(deed.data) : null };
}

/**
 * Refines the standard draft with Claude, following the firm's drafting
 * instructions and accepted reference drafts. Only edits come back; each is
 * checked so no number (amount, date, area, registration detail) changes.
 */
export async function refineDraft(input: unknown): Promise<Result<{ version: AiDraftVersion }>> {
  const parsed = z.object({ deedId: z.string().uuid(), language: z.enum(["hindi", "english"]) }).safeParse(input);
  if (!parsed.success) return { error: "Invalid request." };
  if (!isAiConfigured()) return { error: AI_NOT_CONFIGURED };
  const { workspace, deed, data } = await loadDeed(parsed.data.deedId);
  if (!deed || !data) return { error: "Deed not found." };
  if (deed.deed_type === "other" && data.custom) return { error: "Use the Draft tab for documents made from the template library." };
  const { language } = parsed.data;

  const [document] = buildDraftDocuments({ type: deed.deed_type, title: deed.title, referenceNo: deed.reference_no, data, firmName: workspace.firm.name, firmCity: workspace.firm.city }, language);
  const segments = blockSegments(document.blocks);
  const redactor = createRedactor();
  const outline = draftOutline(document.blocks, redactor.redact);
  const terms = protectedTerms(localizeData(data, language));
  const safe = (original: string, replacement: string) => keepsParticulars(original, replacement) && keepsTerms(original, replacement, terms);
  const context = await draftingContext(workspace, deed.deed_type, language);

  try {
    const { data: reply, usage } = await generateJson<{ edits?: Array<Partial<AiEdit>>; notes?: unknown[] }>({
      system: refinePrompt(deed.deed_type, language),
      cachedContext: context.text || undefined,
      content: [
        { text: "MATTER NOTES AND CLIENT INSTRUCTIONS:\n" + (redactor.redact(deed.remarks ?? "").trim() || "(none)") },
        { text: "STANDARD DRAFT (numbered segments; [fixed] parts are already in the deed and cannot be edited):\n" + outline },
      ],
      schema: editsSchema,
      name: "apply_edits",
      description: "Apply edits to the numbered segments of the draft",
      maxTokens: 12000,
      temperature: 0.2,
      timeoutMs: 240_000,
    });

    const skipped: number[] = [];
    const edits: AiEdit[] = [];
    for (const raw of reply.edits ?? []) {
      const index = Number(raw.index);
      if (!Number.isInteger(index) || index < 0 || index >= segments.length) continue;
      if (raw.op === "delete") {
        // Deleting a segment that carries particulars would drop them.
        if (safe(segments[index].text, "")) edits.push({ op: "delete", index });
        else skipped.push(index);
        continue;
      }
      if (raw.op !== "replace" && raw.op !== "insert_after") continue;
      const text = redactor.restore(String(raw.text ?? "")).trim().slice(0, 12000);
      if (!text) continue;
      if (raw.op === "replace" && !safe(segments[index].text, text)) {
        skipped.push(index);
        continue;
      }
      edits.push({ op: raw.op, index, text });
    }
    const notes = (reply.notes ?? []).filter((note): note is string => typeof note === "string" && note.trim() !== "").map((note) => note.trim().slice(0, 600)).slice(0, 8);
    if (skipped.length) notes.push("Kept " + skipped.length + " paragraph" + (skipped.length === 1 ? "" : "s") + " unchanged because the suggested wording altered a number or particular.");

    const version: AiDraftVersion = { baseHash: hashSegments(segments), edits: edits.slice(0, 400), notes, generatedAt: new Date().toISOString() };
    const error = await saveDeedSection(workspace, deed.id, "aiDraft", { ...data.aiDraft, [language]: version });
    if (error) return { error };
    await workspace.supabase.from("activity_log").insert({
      firm_id: workspace.firm.id,
      deed_id: deed.id,
      user_id: workspace.user.id,
      action: "ai_refined_draft",
      details: { ...usageDetails(usage), language, edits: edits.length, references: context.references.length },
    });
    revalidatePath("/app/deeds/" + deed.id);
    return { version };
  } catch (error) {
    return { error: error instanceof AiError ? error.message : "AI refinement failed. Please try again." };
  }
}

export async function discardRefinement(input: unknown): Promise<Result> {
  const parsed = z.object({ deedId: z.string().uuid(), language: z.enum(["hindi", "english"]) }).safeParse(input);
  if (!parsed.success) return { error: "Invalid request." };
  const { workspace, deed, data } = await loadDeed(parsed.data.deedId);
  if (!deed || !data) return { error: "Deed not found." };
  const next = { ...data.aiDraft };
  delete next[parsed.data.language];
  const error = await saveDeedSection(workspace, deed.id, "aiDraft", next);
  if (error) return { error };
  revalidatePath("/app/deeds/" + deed.id);
  return {};
}
