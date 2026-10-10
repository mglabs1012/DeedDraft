import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { getDeedType, type DeedType } from "@/lib/deed-types";
import type { requireWorkspace } from "@/lib/workspace";
import type { AiMemory } from "@/types/database";

/**
 * The AI's drafting memory for a firm:
 *  - notes: standing instructions ("always write बरोज पंजीयन", "dates as 05.10.2026")
 *  - references: accepted, registered drafts used as format and wording guides
 * plus built-in references made from the real Rajasthan deeds in this repo
 * (data/reference-drafts.json, anonymised by scripts/build-reference-drafts.ts).
 */

type Workspace = Awaited<ReturnType<typeof requireWorkspace>>;
export type BuiltInReference = { id: string; deedType: DeedType; language: "hindi" | "english"; title: string; content: string };
export type FirmMemory = { available: boolean; notes: AiMemory[]; references: AiMemory[] };

const MAX_REFERENCE_CHARS = 16000;
const MAX_REFERENCES = 2;

let builtIns: Promise<BuiltInReference[]> | null = null;

export function builtInReferences(): Promise<BuiltInReference[]> {
  builtIns ??= readFile(path.join(process.cwd(), "data", "reference-drafts.json"), "utf8")
    .then((raw) => JSON.parse(raw) as BuiltInReference[])
    .catch(() => []);
  return builtIns;
}

const missingTable = (error: { code?: string; message?: string } | null) => Boolean(error && (error.code === "42P01" || error.code === "PGRST205" || /ai_memory/.test(error.message ?? "")));

/** All memory rows of the firm. `available` is false until migration 202610100005 has been run. */
export async function loadFirmMemory(workspace: Workspace, { enabledOnly = true } = {}): Promise<FirmMemory> {
  let query = workspace.supabase.from("ai_memory").select("*").eq("firm_id", workspace.firm.id).order("created_at", { ascending: false }).limit(200);
  if (enabledOnly) query = query.eq("enabled", true);
  const { data, error } = await query;
  if (error) {
    if (!missingTable(error)) console.error("Could not load AI memory", error);
    return { available: !missingTable(error), notes: [], references: [] };
  }
  const rows = (data ?? []) as AiMemory[];
  return { available: true, notes: rows.filter((row) => row.kind === "note"), references: rows.filter((row) => row.kind === "reference") };
}

const clip = (text: string, max: number) => (text.length > max ? text.slice(0, max) + "\n[… rest of the reference omitted …]" : text);

export type DraftingContext = { notes: string[]; references: Array<{ title: string; content: string; origin: "firm" | "built-in"; language: string }>; text: string };

/**
 * Memory relevant to one deed: firm instructions for all deeds and this type,
 * then up to two reference drafts — the firm's own accepted drafts first,
 * built-in examples otherwise — in the draft language where possible.
 */
export async function draftingContext(workspace: Workspace, deedType: DeedType, language: "hindi" | "english", options: { references?: boolean } = {}): Promise<DraftingContext> {
  const memory = await loadFirmMemory(workspace);
  const notes = memory.notes.filter((note) => !note.deed_type || note.deed_type === deedType).map((note) => note.content.trim()).filter(Boolean).slice(0, 40);

  const references: DraftingContext["references"] = [];
  if (options.references !== false && deedType !== "other") {
    const firm = memory.references.filter((ref) => ref.deed_type === deedType);
    const builtIn = (await builtInReferences()).filter((ref) => ref.deedType === deedType);
    const ordered = [
      ...firm.filter((ref) => ref.language === language).map((ref) => ({ title: ref.title, content: ref.content, origin: "firm" as const, language })),
      ...builtIn.filter((ref) => ref.language === language).map((ref) => ({ title: ref.title, content: ref.content, origin: "built-in" as const, language })),
      ...firm.filter((ref) => ref.language !== language).map((ref) => ({ title: ref.title, content: ref.content, origin: "firm" as const, language: ref.language ?? "" })),
      ...builtIn.filter((ref) => ref.language !== language).map((ref) => ({ title: ref.title, content: ref.content, origin: "built-in" as const, language: ref.language })),
    ];
    references.push(...ordered.slice(0, MAX_REFERENCES).map((ref) => ({ ...ref, content: clip(ref.content, MAX_REFERENCE_CHARS) })));
  }

  const label = getDeedType(deedType).label;
  const parts: string[] = [];
  if (notes.length) parts.push("FIRM DRAFTING INSTRUCTIONS — always follow these:\n" + notes.map((note) => "- " + note.replace(/\n+/g, " ")).join("\n"));
  references.forEach((ref, index) => {
    parts.push(
      "REFERENCE DRAFT " + (index + 1) + " — a " + label + " " + (ref.origin === "firm" ? "accepted by this firm" : "registered in Rajasthan") + " (" + ref.language + "). Use it as a guide for structure, clause order, wording and formalities only. Its names, numbers and details are placeholders or belong to another matter: never copy them.\n<<<\n" + ref.content + "\n>>>",
    );
  });
  return { notes, references, text: parts.join("\n\n") };
}
