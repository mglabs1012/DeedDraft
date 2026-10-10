import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import type { LibraryEntry } from "@/lib/templates/catalog";
import index from "@/lib/templates/library-index.json";

export const libraryIndex = index as LibraryEntry[];
const byId = new Map(libraryIndex.map((entry) => [entry.id, entry]));

export function getLibraryEntry(id: string | undefined | null): LibraryEntry | null {
  return id ? (byId.get(id) ?? null) : null;
}

let texts: Promise<Record<string, string>> | null = null;

/** Full template text, read once from data/template-library/texts.json. */
export async function getTemplateText(id: string): Promise<string | null> {
  texts ??= readFile(path.join(process.cwd(), "data", "template-library", "texts.json"), "utf8").then((raw) => JSON.parse(raw) as Record<string, string>);
  try {
    return (await texts)[id] ?? null;
  } catch (error) {
    texts = null;
    throw error;
  }
}
