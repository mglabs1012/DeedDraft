/**
 * Shared AI contract: the context shape for model calls and the
 * non-destructive merge used when applying AI extraction results.
 * Model calls live in lib/ai/openrouter.ts and app/actions/ai.ts.
 */

import { getDeedType, type DeedType } from "@/lib/deed-types";
import { parseDeedData, type DeedData } from "@/lib/schemas/deed-data";

export type AiTask = "extract_from_documents" | "draft_clauses" | "translate" | "review_draft";

export type AiDocumentRef = {
  id: string;
  fileName: string;
  category: string;
  mimeType: string;
};

export type AiDeedContext = {
  task: AiTask;
  deedType: DeedType;
  deedTypeLabel: string;
  language: "english" | "hindi" | "bilingual";
  referenceNo: string;
  title: string;
  instructions: string;
  data: DeedData;
  documents: AiDocumentRef[];
  firm: { name: string; city: string };
};

/** What an extraction model returns: any subset of DeedData plus provenance. */
export type AiExtraction = {
  data: Partial<DeedData>;
  confidence?: Record<string, number>;
  sources?: Record<string, { documentId: string; page?: number }>;
};

export function buildAiContext(input: Omit<AiDeedContext, "deedTypeLabel">): AiDeedContext {
  return { ...input, deedTypeLabel: getDeedType(input.deedType).label };
}

type Loose = Record<string, unknown>;
const norm = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim().toLowerCase();

/** What makes two list items "the same" when merging AI output into a matter. */
const identityKeys: Record<string, (item: Loose) => string> = {
  parties: (item) => norm(item.role) + "|" + norm(item.fullName),
  properties: (item) => norm(item.identifier) + "|" + norm(item.khasra) + "|" + (norm(item.identifier) || norm(item.khasra) ? "" : norm(item.description)),
  titleChain: (item) => norm(item.instrument) + "|" + norm(item.date) + "|" + (norm(item.serial) || norm(item.from)),
  payments: (item) => String(item.amount ?? "") + "|" + norm(item.reference) + "|" + norm(item.mode),
};

const isEmpty = (value: unknown) => value === undefined || value === null || value === "";

/**
 * Merges model output into existing data without overwriting anything the
 * advocate has already entered: new list items are appended (duplicates of
 * existing items are skipped), empty scalar fields are filled, and the result
 * is re-validated.
 */
export function mergeExtraction(current: DeedData, extraction: Partial<DeedData>): DeedData {
  const merged: Record<string, unknown> = { ...current };
  for (const [key, value] of Object.entries(extraction)) {
    const existing = (current as Record<string, unknown>)[key];
    if (Array.isArray(value)) {
      const list = Array.isArray(existing) ? existing : [];
      const identity = identityKeys[key] ?? ((item: Loose) => String(item.id ?? ""));
      const seen = new Set(list.map((item) => identity(item as Loose)));
      merged[key] = [...list, ...value.filter((item) => {
        const id = identity(item as Loose);
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
      })];
    } else if (value && typeof value === "object") {
      const target = { ...((existing as Record<string, unknown>) ?? {}) };
      for (const [field, fieldValue] of Object.entries(value)) {
        if (isEmpty(target[field]) && !isEmpty(fieldValue)) target[field] = fieldValue;
      }
      merged[key] = target;
    }
  }
  return parseDeedData(merged);
}
