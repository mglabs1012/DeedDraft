import "server-only";

import { aiModel, AiError, fileBlocks, generateJson, pdfTextLayer, type AiUsage, type ContentPart } from "@/lib/ai/claude";
import { anonymisePrompt, referenceReadPrompt } from "@/lib/ai/prompts";
import { deedTypeOrder, type DeedType } from "@/lib/deed-types";

export type ReadReference = { deedType: DeedType; language: "hindi" | "english"; title: string; content: string; usage: AiUsage };

const referenceSchema = {
  type: "object",
  properties: {
    deedType: { type: "string", enum: deedTypeOrder, description: "Deed type; 'other' if none fits" },
    language: { type: "string", enum: ["hindi", "english"] },
    title: { type: "string", description: "Short descriptive title without personal names, e.g. 'Sale deed – residential plot, Ajmer'" },
    content: { type: "string", description: "Full anonymised text, paragraphs separated by a blank line" },
  },
  required: ["deedType", "language", "title", "content"],
};

const DEVANAGARI = /[ऀ-ॿ]/g;

/**
 * Reads an accepted draft (PDF, Word, photo or pasted text), corrects Kruti Dev
 * conversion, classifies it and anonymises it for use as a drafting reference.
 */
export async function readReferenceDraft({ bytes, mimeType, fileName, text }: { bytes?: Uint8Array; mimeType?: string; fileName: string; text?: string }): Promise<ReadReference> {
  let content: ContentPart[];
  if (text !== undefined) {
    content = [{ text: "DOCUMENT TEXT:\n" + text.slice(0, 120000) }];
  } else if (bytes && mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    if (value.trim().length < 200) throw new AiError("This Word file has almost no text.");
    content = [{ text: "DOCUMENT TEXT:\n" + value.slice(0, 120000) }];
  } else if (bytes && mimeType === "application/pdf") {
    const layer = await pdfTextLayer(bytes);
    const devanagari = (layer.text.match(DEVANAGARI) ?? []).length;
    const cleanUnicode = !layer.krutiDev && layer.text.length > 1500 && (devanagari > 300 || /[a-z]{4,}/i.test(layer.text));
    // Clean typed PDFs are read from their text (faster, cheaper); scans and Kruti Dev also get the page images.
    content = cleanUnicode ? [{ text: "DOCUMENT TEXT (typed PDF):\n" + layer.text.slice(0, 120000) }] : await fileBlocks(mimeType, bytes, fileName);
  } else if (bytes && mimeType && /^image\/(jpeg|png)$/.test(mimeType)) {
    content = await fileBlocks(mimeType, bytes, fileName);
  } else {
    throw new AiError("Upload a PDF, Word (.docx), JPG or PNG file.");
  }

  const { data, usage } = await generateJson<{ deedType?: string; language?: string; title?: string; content?: string }>({
    system: referenceReadPrompt,
    content: [...content, { text: "File name: " + fileName + ". Prepare this document as an anonymous reference." }],
    schema: referenceSchema,
    name: "save_reference",
    description: "Save the cleaned, anonymised reference draft",
    model: aiModel("extraction"),
    maxTokens: 24000,
    temperature: 0,
    timeoutMs: 290_000,
  });
  const body = (data.content ?? "").trim();
  if (body.length < 300) throw new AiError("Could not read enough text from this document.");
  return {
    deedType: deedTypeOrder.includes(data.deedType as DeedType) ? (data.deedType as DeedType) : "other",
    language: data.language === "english" ? "english" : "hindi",
    title: (data.title ?? "").trim().slice(0, 200) || fileName,
    content: body.slice(0, 190000),
    usage,
  };
}

/** Anonymises a finalised draft from this app before it is stored as a reference. */
export async function anonymiseDraft(text: string): Promise<{ content: string; usage: AiUsage }> {
  const { data, usage } = await generateJson<{ content?: string }>({
    system: anonymisePrompt,
    content: text.slice(0, 120000),
    schema: { type: "object", properties: { content: { type: "string" } }, required: ["content"] },
    name: "save_anonymised",
    description: "Save the anonymised deed text",
    model: aiModel("fast"),
    maxTokens: 24000,
    temperature: 0,
    timeoutMs: 240_000,
  });
  const content = (data.content ?? "").trim();
  if (content.length < 200) throw new AiError("The anonymised text came back empty. Please try again.");
  return { content, usage };
}
