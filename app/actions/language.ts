"use server";

import { z } from "zod";

import { AiError, aiModel, generateJson, isAiConfigured, usageDetails } from "@/lib/ai/claude";
import { aiAllowance } from "@/lib/ai/guard.server";
import { conversionPrompt } from "@/lib/ai/prompts";
import { saveDeedSection } from "@/lib/deed-sections.server";
import { pendingConversions } from "@/lib/drafting/localize";
import { convertOffline, isShortValue } from "@/lib/drafting/transliterate";
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

/** Spellings this firm already used in its recent deeds (including the user's corrections). */
async function firmGlossary(workspace: Awaited<ReturnType<typeof requireWorkspace>>, language: "hindi" | "english", exclude: string) {
  const { data } = await workspace.supabase.from("deeds").select("id, localized:data->localized").eq("firm_id", workspace.firm.id).neq("id", exclude).order("updated_at", { ascending: false }).limit(60);
  const glossary: Record<string, string> = {};
  // Oldest first, so the most recent spelling wins.
  for (const row of [...(data ?? [])].reverse() as Array<{ localized?: Partial<Localized> | null }>) Object.assign(glossary, row.localized?.[language] ?? {});
  return glossary;
}

export type ConversionReport = { converted: number; fromFirm: number; offline: number; ai: number; toCheck: string[] };

/**
 * Converts names, addresses and other typed values into the draft language's
 * script (Hindi ⇄ English) so nobody has to type them twice. Fast path first:
 * the firm's earlier spellings, then the built-in dictionary (both instant and
 * free); the AI only sees values neither knows, in parallel batches. Without
 * AI, a rule-based transliteration is used and listed for the user to check.
 * Results are saved on the deed and can be corrected.
 */
export async function convertForDraft(input: unknown): Promise<Result<{ localized: Localized } & ConversionReport>> {
  const parsed = z.object({ deedId: z.string().uuid(), language: languageSchema }).safeParse(input);
  if (!parsed.success) return { error: "Invalid request." };
  const { workspace, deed, data } = await loadDeed(parsed.data.deedId);
  if (!deed || !data) return { error: "Deed not found." };
  const { language } = parsed.data;

  const pending = pendingConversions(data, language, [workspace.firm.city]);
  const report: ConversionReport = { converted: 0, fromFirm: 0, offline: 0, ai: 0, toCheck: [] };
  if (!pending.length) return { localized: data.localized, ...report };

  const map = { ...data.localized[language] };
  const glossary = await firmGlossary(workspace, language, deed.id).catch(() => ({} as Record<string, string>));
  const unknown: string[] = [];
  for (const value of pending) {
    if (glossary[value]) { map[value] = glossary[value]; report.fromFirm += 1; continue; }
    const offline = convertOffline(value, language);
    if (offline.confident && keepsParticulars(value, offline.text)) { map[value] = offline.text; report.offline += 1; }
    else unknown.push(value);
  }

  let aiError = "";
  if (unknown.length && isAiConfigured()) {
    const limited = await aiAllowance(workspace);
    if (limited) aiError = limited;
    else {
      const batches: string[][] = [];
      for (let start = 0; start < unknown.length; start += BATCH) batches.push(unknown.slice(start, start + BATCH));
      const results = await Promise.allSettled(batches.map(async (batch) => {
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
        void workspace.supabase.from("activity_log").insert({ firm_id: workspace.firm.id, deed_id: deed.id, user_id: workspace.user.id, action: "ai_converted_text", details: { ...usageDetails(usage), language, values: batch.length } }).then(() => undefined, () => undefined);
        return { batch, items: reply.items ?? [] };
      }));
      for (const result of results) {
        if (result.status === "rejected") { aiError = result.reason instanceof AiError ? result.reason.message : "Some names could not be converted by AI."; continue; }
        const wanted = new Set(result.value.batch);
        for (const item of result.value.items) {
          const source = item.source ?? "";
          const target = (item.target ?? "").trim();
          // Numbers (house, plot, PIN) must survive conversion unchanged.
          if (wanted.has(source) && target && keepsParticulars(source, target)) { map[source] = target.slice(0, 8000); report.ai += 1; }
        }
      }
    }
  }

  // Anything still missing: names and short values get a rule-based conversion to check; sentences stay as typed.
  for (const value of unknown) {
    if (map[value]) continue;
    if (isShortValue(value)) {
      const offline = convertOffline(value, language);
      if (keepsParticulars(value, offline.text)) { map[value] = offline.text; report.offline += 1; }
    }
    report.toCheck.push(value);
  }
  report.converted = report.fromFirm + report.offline + report.ai;

  const localized: Localized = { ...data.localized, [language]: map };
  const error = await saveDeedSection(workspace, deed.id, "localized", localized);
  if (error) return { error };
  if (aiError && report.toCheck.length) report.toCheck.unshift("AI conversion: " + aiError);
  return { localized, ...report };
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
  return { localized };
}
