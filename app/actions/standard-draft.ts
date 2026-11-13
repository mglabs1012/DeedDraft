"use server";

import { z } from "zod";
import { chatEditDraft } from "@/app/actions/ai";
import { convertForDraft } from "@/app/actions/language";
import { saveDraftVersion, type SavedDraft } from "@/app/actions/drafts";
import { draftFromTemplate } from "@/app/actions/templates";
import { isAiConfigured } from "@/lib/ai/claude";
import { generateEditable } from "@/lib/drafting";
import { dedupeEditable } from "@/lib/drafting/dedupe";
import { applyOperations, type EditableDraft } from "@/lib/drafting/editable";
import { parseDeedData, type Localized } from "@/lib/schemas/deed-data";
import { requireWorkspace } from "@/lib/workspace";
import { assertTaskActive, reportDraftStage } from "@/lib/ai/task-context";

/**
 * Saved versions of a deed's drafts. Only the latest version of each language
 * comes with its text (that is what opens); older versions are listed by
 * number, date and note, and their text is fetched when one is chosen. This
 * keeps opening the Draft tab fast however many versions exist.
 */
export async function loadStandardDrafts(input: unknown): Promise<{ error?: string; drafts: SavedDraft[] }> {
  const id = z.string().uuid().safeParse(input);
  if (!id.success) return { error: "Invalid deed.", drafts: [] };
  const workspace = await requireWorkspace();
  const drafts = () => workspace.supabase.from("deed_drafts");
  const latest = (language: "hindi" | "english") => drafts().select("id, content").eq("deed_id", id.data).eq("firm_id", workspace.firm.id).eq("language", language).order("version", { ascending: false }).limit(1);
  const [list, hindi, english] = await Promise.all([
    drafts().select("id, language, version, note, created_at").eq("deed_id", id.data).eq("firm_id", workspace.firm.id).order("version", { ascending: false }).limit(40),
    latest("hindi"),
    latest("english"),
  ]);
  if (list.error || hindi.error || english.error) return { error: "Draft versions could not be loaded. Check database migration 0004.", drafts: [] };
  const content = new Map([...(hindi.data ?? []), ...(english.data ?? [])].map((row) => [row.id, row.content]));
  return { drafts: (list.data ?? []).map((row) => ({ ...row, content: content.get(row.id) ?? null })) as SavedDraft[] };
}

/** The text of one older version, fetched when it is chosen from Versions. */
export async function loadDraftVersion(input: unknown): Promise<{ error: string } | { error?: undefined; content: unknown }> {
  const parsed = z.object({ deedId: z.string().uuid(), id: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { error: "Invalid version." };
  const workspace = await requireWorkspace();
  const { data, error } = await workspace.supabase.from("deed_drafts").select("content").eq("id", parsed.data.id).eq("deed_id", parsed.data.deedId).eq("firm_id", workspace.firm.id).maybeSingle();
  if (error || !data) return { error: "This version could not be opened. Try again." };
  return { content: data.content };
}

type DraftLanguageChoice = "hindi" | "english";

/**
 * Prepares the draft in Hindi, English or both. The standard template draft is
 * built instantly from the matter facts; the AI is only called when the user
 * gave instructions (it then applies them with the firm's reference drafts as
 * a style guide). Each language is saved as its own version.
 */
export async function generateStandardDraft(input: unknown): Promise<{ error?: string; draft?: SavedDraft; drafts?: SavedDraft[]; notes?: string[]; localized?: Localized }> {
  reportDraftStage("loading", "Loading your deed and instructions");
  const parsed = z.object({ id: z.string().uuid(), language: z.enum(["hindi", "english", "both"]), instructions: z.string().trim().max(4000) }).safeParse(input);
  if (!parsed.success) return { error: "Check your instructions (maximum 4,000 characters)." };
  const workspace = await requireWorkspace();
  const { data: deed } = await workspace.supabase.from("deeds").select("*").eq("id", parsed.data.id).eq("firm_id", workspace.firm.id).maybeSingle();
  if (!deed) return { error: "Deed not found." };
  const instructions = parsed.data.instructions;
  if ((deed.remarks ?? "") !== instructions) {
    const { error: remarksError } = await workspace.supabase.from("deeds").update({ remarks: instructions || null }).eq("id", deed.id).eq("firm_id", workspace.firm.id);
    if (remarksError) return { error: "Instructions could not be saved. Try again." };
  }
  const languages: DraftLanguageChoice[] = parsed.data.language === "both" ? ["hindi", "english"] : [parsed.data.language];
  const label = (language: DraftLanguageChoice) => (languages.length > 1 ? (language === "hindi" ? "Hindi: " : "English: ") : "");
  let data = parseDeedData(deed.data);
  const notes: string[] = [];
  const ai = isAiConfigured();
  let built: Array<{ language: DraftLanguageChoice; draft: EditableDraft }>;

  if (data.custom) {
    // Library templates are written by the AI; one language at a time because each saves into the same record.
    built = [];
    for (const language of languages) {
      reportDraftStage("drafting", "Preparing the " + (language === "hindi" ? "Hindi" : "English") + " document from your template and papers");
      const result = await draftFromTemplate({ id: deed.id, language });
      if (result.error !== undefined) return { error: label(language) + result.error };
      built.push({ language, draft: { language, blocks: [
        { id: "title", kind: "title", text: result.draft.title },
        ...result.draft.paragraphs.map((text, index) => ({ id: "p" + index, kind: "para" as const, text })),
      ] } });
    }
  } else {
    // Names and addresses in each draft's script: dictionary and firm spellings first, AI only for unknown words.
    reportDraftStage("converting", "Writing names and addresses in " + (languages.length > 1 ? "Hindi and English" : languages[0] === "hindi" ? "Hindi" : "English"));
    for (const language of languages) {
      const converted = await convertForDraft({ deedId: deed.id, language });
      if (converted.error !== undefined) { notes.push(label(language) + "Name conversion: " + converted.error); continue; }
      data = { ...data, localized: converted.localized };
      if (converted.toCheck.length) notes.push(label(language) + "Check how these were written: " + converted.toCheck.slice(0, 12).join("; ") + (converted.toCheck.length > 12 ? " …" : "") + ". Correct them under Names in the draft language.");
    }
    assertTaskActive();
    reportDraftStage("drafting", instructions && ai ? "Applying your instructions to the draft" : "Building the draft from your papers");
    const input = { type: deed.deed_type, title: deed.title, referenceNo: deed.reference_no, data, firmName: workspace.firm.name, firmCity: workspace.firm.city };
    try {
      built = await Promise.all(languages.map(async (language) => {
        let draft = generateEditable(input, language);
        if (instructions && ai) {
          const result = await chatEditDraft({ deedId: deed.id, draft, useReferences: true, history: [], message: "Prepare this first draft using the saved matter facts. Follow these user drafting directions, adding, retaining or removing clauses as needed. Never invent missing facts; leave blanks for review.\n\n" + instructions.slice(0, 3500) });
          if (result.error !== undefined) throw new Error(label(language) + "AI drafting did not finish: " + result.error + " Your documents and details are saved.");
          draft = applyOperations(draft, result.operations);
          notes.push(label(language) + result.reply);
          // Never save a draft with the same clause twice (the AI may re-add one the template has).
          const unique = dedupeEditable(draft);
          draft = unique.draft;
          if (unique.removed.length) notes.push(label(language) + unique.removed.length + " repeated clause" + (unique.removed.length === 1 ? " was" : "s were") + " removed.");
        }
        return { language, draft };
      }));
    } catch (error) {
      return { error: error instanceof Error ? error.message : "AI drafting did not finish. Your documents and details are saved." };
    }
    if (instructions && !ai) notes.push("AI is not configured, so this is the standard template draft. Your instructions are saved but have not been applied.");
    else if (!instructions) notes.push("Standard draft prepared from your papers. To have the AI tailor the wording, write instructions and prepare a new version, or use the drafting assistant.");
  }

  reportDraftStage("saving", "Saving " + (languages.length > 1 ? "both drafts" : "the draft"));
  assertTaskActive();
  const note = instructions && ai ? "Prepared with AI from your instructions; requires review" : "Standard template draft; requires review";
  const saved: SavedDraft[] = [];
  for (const { draft } of built) {
    const result = await saveDraftVersion({ deedId: deed.id, draft, note });
    if (result.error || !result.draft) return { error: result.error ?? "The draft could not be saved." };
    saved.push(result.draft);
  }
  return { draft: saved[0], drafts: saved, notes, localized: data.localized };
}
