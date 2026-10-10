import { html, renderDraftHtml, type Block, type DraftDocument } from "@/lib/drafting/blocks";
import type { CustomDraft } from "@/lib/schemas/deed-data";

/** Short all-caps lines (e.g. "NOW THIS AGREEMENT WITNESSETH") read as headings. */
function isHeading(text: string) {
  return text.length <= 90 && /[A-Z]/.test(text) && text === text.toUpperCase() && !/[।]/.test(text);
}

export function customDraftBlocks(draft: CustomDraft): Block[] {
  return [
    { t: "title", text: draft.title },
    ...draft.paragraphs.map<Block>((paragraph) => (isHeading(paragraph) ? { t: "heading", text: paragraph } : { t: "para", html: html`${paragraph}` })),
  ];
}

export function customDraftHtml({ drafts, title, referenceNo, footer }: { drafts: Array<{ language: "english" | "hindi"; draft: CustomDraft }>; title: string; referenceNo: string; footer?: string }) {
  const documents: DraftDocument[] = drafts.map(({ language, draft }) => ({ language, blocks: customDraftBlocks(draft) }));
  return renderDraftHtml({ title: referenceNo + " · " + title, documents, footer });
}

/** The template itself as a draft, for filling by hand when AI is not set up. */
export function templateAsDraft(title: string, text: string): CustomDraft {
  return { title, paragraphs: text.split("\n").slice(text.split("\n")[0]?.trim().toUpperCase() === title.toUpperCase() ? 1 : 0), edited: false };
}

/** Paragraphs ⇄ editable text (blank line between paragraphs). */
export const draftToText = (draft: CustomDraft) => draft.paragraphs.join("\n\n");
export const textToParagraphs = (text: string) => text.split(/\n\s*\n/).map((item) => item.replace(/\s*\n\s*/g, " ").trim()).filter(Boolean);
