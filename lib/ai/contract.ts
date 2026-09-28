/**
 * Contract for upcoming AI features (extraction from property papers, clause
 * drafting and translation). Nothing here calls a model yet — it fixes the shape
 * of what a model receives and how its output is merged, so the UI and drafting
 * engine don't change when AI is plugged in.
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

const isEmpty = (value: unknown) => value === undefined || value === null || value === "";

/**
 * Merges model output into existing data without overwriting anything the
 * advocate has already entered: new list items are appended, empty scalar
 * fields are filled, and the result is re-validated.
 */
export function mergeExtraction(current: DeedData, extraction: Partial<DeedData>): DeedData {
  const merged: Record<string, unknown> = { ...current };
  for (const [key, value] of Object.entries(extraction)) {
    const existing = (current as Record<string, unknown>)[key];
    if (Array.isArray(value)) {
      const list = Array.isArray(existing) ? existing : [];
      const ids = new Set(list.map((item) => (item as { id?: string }).id));
      merged[key] = [...list, ...value.filter((item) => !ids.has((item as { id?: string }).id))];
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
