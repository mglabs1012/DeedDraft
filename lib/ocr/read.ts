import "server-only";

import { AiError, aiModel, fileBlocks, generate, MAX_DOCUMENTS_PER_REQUEST, type AiUsage } from "@/lib/ai/claude";

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
  // pdf.js takes ownership of (detaches) the buffer it is given: pass a copy so the bytes stay usable for AI OCR.
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const { text, totalPages } = await extractText(pdf, { mergePages: false });
  const pages = Array.isArray(text) ? text : [text];
  return { pages, totalPages };
}

async function readDocx(bytes: Uint8Array) {
  const mammoth = await import("mammoth");
  const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
  return value;
}

/** AI OCR on Bedrock: pages are split to Bedrock's limits, photos straightened and resized, Kruti Dev text layers converted. */
async function aiOcr(bytes: Uint8Array, mime: string, fileName: string): Promise<{ text: string; usage: AiUsage }> {
  const blocks = await fileBlocks(mime, bytes, fileName);
  if (blocks.filter((block) => block.document !== undefined).length > MAX_DOCUMENTS_PER_REQUEST) {
    throw new AiError("This PDF is too large to read in one go (Bedrock reads at most 5 parts of 4.5 MB). Upload fewer pages or a lower-resolution scan.");
  }
  return generate({
    model: aiModel("extraction"),
    system: OCR_PROMPT,
    content: [...blocks, { text: "Transcribe: " + fileName }],
    maxTokens: 24_000,
    temperature: 0,
    timeoutMs: 240_000,
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
    throw new AiError("This is a scanned document or photo. AI OCR is needed to read it — add the AWS Bedrock settings to .env.local.");
  }

  const { text, usage } = await aiOcr(bytes, mime, fileName);
  const tidy = tidyText(text);
  return { text: tidy.slice(0, MAX_TEXT), source: "ai-ocr", quality: assessText(tidy, local?.pages ?? 1), pages: local?.pages ?? null, usage };
}
