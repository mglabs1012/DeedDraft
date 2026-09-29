/**
 * Decides whether text pulled from a PDF/DOCX text layer is usable, or whether
 * the page must be read by AI OCR instead. Pure — covered by `npm test`.
 */

import { krutiDevToUnicode, looksLikeKrutiDev } from "@/lib/text/krutidev";

export type TextQuality = "good" | "poor";

const DEVANAGARI = /[\u0900-\u097F]/g;
/** A dependent vowel sign / virama right after a space means broken glyph order ("विन ां क"). */
const BROKEN_SIGN = /\s[\u093E-\u094D\u0962\u0963]/g;

export function assessText(text: string, pages = 1): TextQuality {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length < Math.max(80, 120 * pages)) return "poor";
  const devanagari = (clean.match(DEVANAGARI) ?? []).length;
  if (devanagari > 50) {
    const broken = (clean.match(BROKEN_SIGN) ?? []).length;
    if (broken / devanagari > 0.015) return "poor";
  }
  const letters = (clean.match(/[A-Za-z\u0900-\u097F]/g) ?? []).length;
  if (letters / clean.length < 0.4) return "poor";
  return "good";
}

/** Page-aware check: a PDF whose pages are partly scans (no text) needs OCR even if other pages have text. */
export function assessPages(pages: string[]): TextQuality {
  if (!pages.length) return "poor";
  const empty = pages.filter((page) => page.replace(/\s+/g, "").length < 80).length;
  if (empty / pages.length > 0.25) return "poor";
  return assessText(pages.join("\n"), pages.length);
}

/** Converts Kruti Dev text to Unicode when detected; returns the text and whether it converted. */
export function normaliseLegacyHindi(text: string): { text: string; converted: boolean } {
  if (!looksLikeKrutiDev(text)) return { text, converted: false };
  return { text: krutiDevToUnicode(text), converted: true };
}

/** Collapses runs of blank lines and trailing spaces; keeps line structure for clause detection. */
export function tidyText(text: string) {
  return text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
