import "server-only";

import { AiError, aiModel, chatCompletion, type AiUsage, type ContentPart } from "@/lib/ai/openrouter";

import { assessPages, assessText, normaliseLegacyHindi, tidyText, type TextQuality } from "./quality";
import { krutiDevToUnicode } from "@/lib/text/krutidev";

export type TextSource = "pdf-text" | "pdf-text-krutidev" | "docx" | "docx-krutidev" | "ai-ocr";

export type ReadResult = {
  text: string;
  source: TextSource;
  quality: TextQuality;
  pages: number | null;
  usage?: AiUsage;
};

export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MAX_TEXT = 200_000;

const OCR_PROMPT = `You are an OCR engine for Indian (mostly Rajasthan) property papers: registered deeds, pattas, jamabandi, e-stamp certificates, loan letters, site plans (naksha) and ID cards.
Transcribe ALL text in the document verbatim, page by page, in Unicode. Keep Hindi in Devanagari and English in English; do not translate or summarise.
If Hindi appears as garbled Latin characters (legacy Kruti Dev font), output the correct Devanagari.
Preserve line breaks, numbering, tables (use " | " between cells) and figures exactly (amounts, dates, khasra, Aadhaar, registration numbers).
Mark each page as "--- Page N ---". Write [illegible] for anything you cannot read — never guess numbers or names.
For stamps, seals and handwriting, transcribe what is legible and label it, e.g. [stamp: ...], [handwritten: ...].
Output only the transcription.`;

async function readPdfTextLayer(bytes: Uint8Array) {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(bytes);
  const { text, totalPages } = await extractText(pdf, { mergePages: false });
  const pages = Array.isArray(text) ? text : [text];
  return { pages, totalPages };
}

async function readDocx(bytes: Uint8Array) {
  const mammoth = await import("mammoth");
  const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
  return value;
}

async function aiOcr(bytes: Uint8Array, mime: string, fileName: string): Promise<{ text: string; usage: AiUsage }> {
  const dataUrl = "data:" + mime + ";base64," + Buffer.from(bytes).toString("base64");
  const part: ContentPart = mime === "application/pdf" ? { type: "file", file: { filename: fileName, file_data: dataUrl } } : { type: "image_url", image_url: { url: dataUrl } };
  return chatCompletion({
    model: aiModel("extraction"),
    maxTokens: 16_000,
    temperature: 0,
    timeoutMs: 110_000,
    messages: [
      { role: "system", content: OCR_PROMPT },
      { role: "user", content: [{ type: "text", text: "Transcribe: " + fileName }, part] },
    ],
  });
}

/**
 * Reads a document's text: free text-layer extraction first (with Kruti Dev
 * conversion), AI OCR only when the text layer is missing or garbled.
 */
export async function readDocument({ bytes, mime, fileName, allowAi }: { bytes: Uint8Array; mime: string; fileName: string; allowAi: boolean }): Promise<ReadResult> {
  let local: ReadResult | null = null;

  if (mime === "application/pdf") {
    try {
      const { pages, totalPages } = await readPdfTextLayer(bytes);
      const converted = normaliseLegacyHindi(pages.join("\n\u0000\n")).converted;
      const pageTexts = pages.map((page) => tidyText(converted ? krutiDevToUnicode(page) : page));
      const text = pageTexts.map((page, index) => "--- Page " + (index + 1) + " ---\n" + page).join("\n\n");
      local = { text, source: converted ? "pdf-text-krutidev" : "pdf-text", quality: assessPages(pageTexts), pages: totalPages };
    } catch {
      local = null;
    }
  } else if (mime === DOCX_MIME) {
    const legacy = normaliseLegacyHindi(await readDocx(bytes));
    const tidy = tidyText(legacy.text);
    return { text: tidy.slice(0, MAX_TEXT), source: legacy.converted ? "docx-krutidev" : "docx", quality: assessText(tidy), pages: null };
  }

  if (local?.quality === "good") return { ...local, text: local.text.slice(0, MAX_TEXT) };
  if (!allowAi) {
    if (local) return { ...local, text: local.text.slice(0, MAX_TEXT) };
    throw new AiError("This is a scanned document or photo. AI OCR is needed to read it — configure OPENROUTER_API_KEY.");
  }

  const { text, usage } = await aiOcr(bytes, mime, fileName);
  const tidy = tidyText(text);
  return { text: tidy.slice(0, MAX_TEXT), source: "ai-ocr", quality: assessText(tidy, local?.pages ?? 1), pages: local?.pages ?? null, usage };
}
