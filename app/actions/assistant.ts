"use server";

import type { Message } from "@aws-sdk/client-bedrock-runtime";
import { z } from "zod";

import { AI_NOT_CONFIGURED, AiError, generateJson, isAiConfigured, usageDetails } from "@/lib/ai/claude";
import { aiAllowance } from "@/lib/ai/guard.server";
import { relevantFacts } from "@/lib/ai/facts";
import { draftingContext } from "@/lib/ai/memory.server";
import { assistantPrompt } from "@/lib/ai/prompts";
import { createRedactor } from "@/lib/ai/redact";
import { saveDeedSection } from "@/lib/deed-sections.server";
import { buildDraftDocuments } from "@/lib/drafting";
import { blockSegments } from "@/lib/drafting/segments";
import { parseDeedData, type ChatMessage } from "@/lib/schemas/deed-data";
import { getLibraryEntry } from "@/lib/templates/library.server";
import { requireWorkspace } from "@/lib/workspace";

type Result<T = object> = { error: string } | ({ error?: undefined } & T);

const HISTORY = 16;
const KEEP = 60;

const replySchema = {
  type: "object",
  properties: {
    reply: { type: "string", description: "Answer to the user, plain text" },
    clauses: { type: "array", items: { type: "string" }, description: "Ready-to-use clauses for the deed, only when asked for wording" },
    remember: { type: "string", description: "One-line instruction to remember for future drafts, only when the user asks to remember something" },
  },
  required: ["reply"],
};

/**
 * Chat about the open deed. The assistant sees the matter, the current draft
 * and the firm's memory (prompt-cached across turns), answers in the user's
 * language, and can suggest clauses or things to remember.
 */
export async function askAssistant(input: unknown): Promise<Result<{ messages: ChatMessage[] }>> {
  const parsed = z.object({ deedId: z.string().uuid(), message: z.string().trim().min(1).max(4000) }).safeParse(input);
  if (!parsed.success) return { error: "Type a question." };
  if (!isAiConfigured()) return { error: AI_NOT_CONFIGURED };
  const workspace = await requireWorkspace();
  const { data: deed } = await workspace.supabase.from("deeds").select("*").eq("id", parsed.data.deedId).eq("firm_id", workspace.firm.id).maybeSingle();
  if (!deed) return { error: "Deed not found." };
  const limited = await aiAllowance(workspace);
  if (limited) return { error: limited };
  const data = parseDeedData(deed.data);
  const draftLanguage = deed.language === "english" ? "english" : "hindi";
  const redactor = createRedactor();

  // Matter facts and the current draft text, identity numbers redacted.
  const template = getLibraryEntry(data.custom?.templateId);
  const draftText = template
    ? (data.custom?.drafts[draftLanguage] ?? data.custom?.drafts.english)?.paragraphs.join("\n") ?? ""
    : blockSegments(buildDraftDocuments({ type: deed.deed_type, title: deed.title, referenceNo: deed.reference_no, data, firmName: workspace.firm.name, firmCity: workspace.firm.city }, draftLanguage)[0].blocks).map((segment) => segment.text).join("\n");
  const facts = relevantFacts(deed.deed_type, data);
  const memory = await draftingContext(workspace, deed.deed_type, draftLanguage, { references: false });
  const context = [
    memory.text,
    "MATTER: " + (template ? template.title : deed.deed_type) + " · " + deed.title + " · draft language " + deed.language + " · status " + deed.status,
    "CLIENT INSTRUCTIONS:\n" + redactor.redact(deed.remarks ?? "(none)"),
    "MATTER DATA (JSON):\n" + redactor.redact(JSON.stringify(facts)),
    "CURRENT DRAFT:\n" + redactor.redact(draftText).slice(0, 60000),
  ]
    .filter(Boolean)
    .join("\n\n");

  const now = new Date().toISOString();
  const history = data.chat.slice(-HISTORY);
  const turns: Message[] = [...history, { role: "user" as const, text: parsed.data.message, at: now }].map((message) => ({ role: message.role, content: [{ text: redactor.redact(message.text) }] }));
  // Converse needs alternating turns starting with the user.
  while (turns.length && turns[0].role !== "user") turns.shift();

  try {
    const { data: reply, usage } = await generateJson<{ reply?: string; clauses?: unknown[]; remember?: string }>({
      system: assistantPrompt(deed.deed_type, deed.language),
      cachedContext: context,
      content: turns,
      schema: replySchema,
      name: "respond",
      description: "Reply to the user",
      maxTokens: 4000,
      temperature: 0.3,
      timeoutMs: 120_000,
    });
    const answer: ChatMessage = {
      role: "assistant",
      text: redactor.restore((reply.reply ?? "").trim()).slice(0, 20000) || "Sorry, I could not answer that. Please rephrase.",
      at: new Date().toISOString(),
      clauses: (reply.clauses ?? []).filter((clause): clause is string => typeof clause === "string" && clause.trim() !== "").map((clause) => redactor.restore(clause.trim()).slice(0, 4000)).slice(0, 10),
      remember: reply.remember?.trim().slice(0, 1000) || undefined,
    };
    const messages = [...data.chat, { role: "user" as const, text: parsed.data.message, at: now }, answer].slice(-KEEP);
    const error = await saveDeedSection(workspace, deed.id, "chat", messages);
    if (error) return { error };
    await workspace.supabase.from("activity_log").insert({ firm_id: workspace.firm.id, deed_id: deed.id, user_id: workspace.user.id, action: "ai_chat", details: usageDetails(usage) });
    return { messages };
  } catch (error) {
    return { error: error instanceof AiError ? error.message : "The assistant could not answer. Please try again." };
  }
}

export async function clearAssistant(input: unknown): Promise<Result> {
  const parsed = z.object({ deedId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { error: "Invalid request." };
  const workspace = await requireWorkspace();
  const { data: deed } = await workspace.supabase.from("deeds").select("id").eq("id", parsed.data.deedId).eq("firm_id", workspace.firm.id).maybeSingle();
  if (!deed) return { error: "Deed not found." };
  const error = await saveDeedSection(workspace, deed.id, "chat", []);
  return error ? { error } : {};
}
