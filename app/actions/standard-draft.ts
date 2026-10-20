"use server";

import { z } from "zod";
import { chatEditDraft } from "@/app/actions/ai";
import { convertForDraft } from "@/app/actions/language";
import { saveDraftVersion, type SavedDraft } from "@/app/actions/drafts";
import { draftFromTemplate } from "@/app/actions/templates";
import { isAiConfigured } from "@/lib/ai/claude";
import { generateEditable } from "@/lib/drafting";
import { applyOperations, type EditableDraft } from "@/lib/drafting/editable";
import { parseDeedData } from "@/lib/schemas/deed-data";
import { requireWorkspace } from "@/lib/workspace";

export async function loadStandardDrafts(input: unknown): Promise<{ error?: string; drafts: SavedDraft[] }> {
  const id = z.string().uuid().safeParse(input);
  if (!id.success) return { error: "Invalid deed.", drafts: [] };
  const workspace = await requireWorkspace();
  const { data, error } = await workspace.supabase.from("deed_drafts")
    .select("id, language, version, note, created_at, content").eq("deed_id", id.data).eq("firm_id", workspace.firm.id)
    .order("version", { ascending: false }).limit(20);
  return error ? { error: "Draft versions could not be loaded. Check database migration 0004.", drafts: [] } : { drafts: data as SavedDraft[] };
}

export async function generateStandardDraft(input: unknown): Promise<{ error?: string; draft?: SavedDraft; notes?: string[] }> {
  const parsed = z.object({ id: z.string().uuid(), language: z.enum(["hindi", "english"]), instructions: z.string().trim().max(4000) }).safeParse(input);
  if (!parsed.success) return { error: "Check your instructions (maximum 4,000 characters)." };
  const workspace = await requireWorkspace();
  const { data: deed } = await workspace.supabase.from("deeds").select("*").eq("id", parsed.data.id).eq("firm_id", workspace.firm.id).maybeSingle();
  if (!deed) return { error: "Deed not found." };
  const { error: remarksError } = await workspace.supabase.from("deeds").update({ remarks: parsed.data.instructions || null }).eq("id", deed.id).eq("firm_id", workspace.firm.id);
  if (remarksError) return { error: "Instructions could not be saved. Try again." };
  let data = parseDeedData(deed.data);
  let draft: EditableDraft;
  const notes: string[] = [];
  if (data.custom) {
    const result = await draftFromTemplate({ id: deed.id, language: parsed.data.language });
    if (result.error !== undefined) return { error: result.error };
    draft = { language: parsed.data.language, blocks: [
      { id: "title", kind: "title", text: result.draft.title },
      ...result.draft.paragraphs.map((text, index) => ({ id: "p" + index, kind: "para" as const, text })),
    ] };
  } else {
    if (isAiConfigured()) {
      const converted = await convertForDraft({ deedId: deed.id, language: parsed.data.language });
      if (converted.error !== undefined) notes.push("Name conversion: " + converted.error);
      else data = { ...data, localized: converted.localized };
    }
    draft = generateEditable({ type: deed.deed_type, title: deed.title, referenceNo: deed.reference_no, data, firmName: workspace.firm.name, firmCity: workspace.firm.city }, parsed.data.language);
    if (isAiConfigured()) {
      const result = await chatEditDraft({ deedId: deed.id, draft, message: "Prepare this first draft using the saved matter facts. Follow these user drafting directions, adding, retaining or removing clauses as needed. Never invent missing facts; leave blanks for review.\n\n" + (parsed.data.instructions || "Retain the standard clauses and improve clarity.").slice(0, 3500), history: [] });
      if (result.error !== undefined) return { error: "AI drafting did not finish: " + result.error + " Your documents and details are saved." };
      draft = applyOperations(draft, result.operations);
      notes.push(result.reply);
    } else if (parsed.data.instructions) {
      notes.push("AI is not configured. This is the standard template draft; your instructions are saved but have not been applied.");
    }
  }
  const result = await saveDraftVersion({ deedId: deed.id, draft, note: isAiConfigured() ? "Standard Mode — generated with AI; requires review" : "Standard template — requires review" });
  return { ...result, notes };
}
