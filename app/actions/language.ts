"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { AI_NOT_CONFIGURED, AiError, aiModel, generateJson, isAiConfigured, usageDetails } from "@/lib/ai/claude";
import { aiAllowance } from "@/lib/ai/guard.server";
import { conversionPrompt } from "@/lib/ai/prompts";
import { saveDeedSection } from "@/lib/deed-sections.server";
import { pendingConversions } from "@/lib/drafting/localize";
import { keepsParticulars } from "@/lib/drafting/segments";
import { parseDeedData, type Localized } from "@/lib/schemas/deed-data";
import { requireWorkspace } from "@/lib/workspace";

type Result<T = object> = { error: string } | ({ error?: undefined } & T);

const languageSchema = z.enum(["hindi", "english"]);
const BATCH = 60;

const itemsSchema = {
  type: "object",
  properties: { items: { type: "array", items: { type: "object", properties: { source: { type: "string" }, target: { type: "string" } }, required: ["source", "target"] } } },
  required: ["items"],
};

async function loadDeed(deedId: string) {
  const workspace = await requireWorkspace();
  const { data: deed } = await workspace.supabase.from("deeds").select("id, data").eq("id", deedId).eq("firm_id", workspace.firm.id).maybeSingle();
  return { workspace, deed, data: deed ? parseDeedData(deed.data) : null };
}

/**
 * Converts names, addresses and other typed values into the draft language's
 * script (Hindi ⇄ English) so nobody has to type them twice. Results are saved
 * and reused; the user can correct any of them.
 */
export async function convertForDraft(input: unknown): Promise<Result<{ localized: Localized; converted: number }>> {
  const parsed = z.object({ deedId: z.string().uuid(), language: languageSchema }).safeParse(input);
  if (!parsed.success) return { error: "Invalid request." };
  const { workspace, deed, data } = await loadDeed(parsed.data.deedId);
  if (!deed || !data) return { error: "Deed not found." };
  const { language } = parsed.data;

  const pending = pendingConversions(data, language, [workspace.firm.city]);
  if (!pending.length) return { localized: data.localized, converted: 0 };
  if (!isAiConfigured()) return { error: AI_NOT_CONFIGURED };
  const limited = await aiAllowance(workspace);
  if (limited) return { error: limited };

  try {
    const wanted = new Set(pending);
    const map = { ...data.localized[language] };
    let converted = 0;
    for (let start = 0; start < pending.length; start += BATCH) {
      const batch = pending.slice(start, start + BATCH);
      const { data: reply, usage } = await generateJson<{ items?: Array<{ source?: string; target?: string }> }>({
        system: conversionPrompt(language),
        content: "Values to convert (JSON array):\n" + JSON.stringify(batch),
        schema: itemsSchema,
        name: "save_conversions",
        description: "Save each value converted into the draft language",
        model: aiModel("fast"),
        maxTokens: 8000,
        temperature: 0,
        timeoutMs: 90_000,
      });
      for (const item of reply.items ?? []) {
        const source = item.source ?? "";
        const target = (item.target ?? "").trim();
        // Numbers (house, plot, PIN) must survive conversion unchanged.
        if (wanted.has(source) && target && keepsParticulars(source, target)) {
          map[source] = target.slice(0, 8000);
          converted += 1;
        }
      }
      await workspace.supabase.from("activity_log").insert({ firm_id: workspace.firm.id, deed_id: deed.id, user_id: workspace.user.id, action: "ai_converted_text", details: { ...usageDetails(usage), language, values: batch.length } });
    }
    const localized: Localized = { ...data.localized, [language]: map };
    const error = await saveDeedSection(workspace, deed.id, "localized", localized);
    if (error) return { error };
    revalidatePath("/app/deeds/" + deed.id);
    return { localized, converted };
  } catch (error) {
    return { error: error instanceof AiError ? error.message : "Could not convert the names. Please try again." };
  }
}

/** Saves the user's corrections to converted values (an empty target removes the conversion). */
export async function saveConversions(input: unknown): Promise<Result<{ localized: Localized }>> {
  const parsed = z
    .object({ deedId: z.string().uuid(), language: languageSchema, items: z.array(z.object({ source: z.string().max(8000), target: z.string().max(8000) })).max(500) })
    .safeParse(input);
  if (!parsed.success) return { error: "Invalid conversions." };
  const { workspace, deed, data } = await loadDeed(parsed.data.deedId);
  if (!deed || !data) return { error: "Deed not found." };
  const map = { ...data.localized[parsed.data.language] };
  for (const { source, target } of parsed.data.items) {
    if (target.trim()) map[source] = target.trim();
    else delete map[source];
  }
  const localized: Localized = { ...data.localized, [parsed.data.language]: map };
  const error = await saveDeedSection(workspace, deed.id, "localized", localized);
  if (error) return { error };
  revalidatePath("/app/deeds/" + deed.id);
  return { localized };
}
