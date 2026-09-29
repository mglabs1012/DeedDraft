/**
 * Editable drafts. A generated draft (Blocks) becomes a flat list of editable
 * text blocks plus "locked" structured blocks (boundary table, schedules,
 * signatures) that stay tied to the matter data. Advocates and the AI chat edit
 * text blocks; the result renders through the same escaping renderer.
 * Only `**bold**` markup is supported in text — no raw HTML is ever stored.
 */

import { z } from "zod";

import { html, SafeHtml, type Block, type DraftDocument } from "./blocks";

export type TextKind = "invocation" | "title" | "meta" | "heading" | "para" | "clause" | "detail";

export type EditableBlock =
  | { id: string; kind: TextKind; text: string; numbered?: boolean; center?: boolean }
  | { id: string; kind: "locked"; block: LockedBlock };

export type LockedBlock =
  | { t: "table"; head?: string[]; rows: string[][]; widths?: string[] }
  | { t: "boundaries"; head: [string, string, string]; rows: Array<[string, string, string]> }
  | { t: "signatures"; items: Array<{ label: string; lines: string[] }> }
  | { t: "pagebreak" };

export type EditableDraft = { language: "hindi" | "english"; blocks: EditableBlock[] };

const text = z.string().max(20_000);
const lockedSchema = z.discriminatedUnion("t", [
  z.object({ t: z.literal("table"), head: z.array(text).max(12).optional(), rows: z.array(z.array(text).max(12)).max(200), widths: z.array(z.string().regex(/^\d{1,3}%$/)).max(12).optional() }),
  z.object({ t: z.literal("boundaries"), head: z.tuple([text, text, text]), rows: z.array(z.tuple([text, text, text])).max(12) }),
  z.object({ t: z.literal("signatures"), items: z.array(z.object({ label: text, lines: z.array(text).max(12) })).max(40) }),
  z.object({ t: z.literal("pagebreak") }),
]);

export const editableBlockSchema = z.union([
  z.object({ id: z.string().min(1).max(64), kind: z.enum(["invocation", "title", "meta", "heading", "para", "clause", "detail"]), text, numbered: z.boolean().optional(), center: z.boolean().optional() }),
  z.object({ id: z.string().min(1).max(64), kind: z.literal("locked"), block: lockedSchema }),
]);

export const editableDraftSchema = z.object({
  language: z.enum(["hindi", "english"]),
  blocks: z.array(editableBlockSchema).max(600),
});

const entities: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " " };

/** Converts our generated HTML fragments to plain text with **bold** markers. */
export function htmlToMarkup(value: string) {
  return value
    .replace(/<strong>([\s\S]*?)<\/strong>/g, "**$1**")
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (match) => entities[match] ?? match);
}

/** Escapes text and turns **bold** into <strong>. */
export function markupToHtml(value: string): SafeHtml {
  const parts = value.split(/\*\*([\s\S]+?)\*\*/g);
  return new SafeHtml(parts.map((part, index) => (index % 2 ? html`<strong>${part}</strong>`.value : html`${part}`.value)).join(""));
}

const plain = (cell: string | SafeHtml) => (cell instanceof SafeHtml ? htmlToMarkup(cell.value) : cell);

export function toEditable(doc: DraftDocument): EditableDraft {
  const blocks: EditableBlock[] = [];
  let counter = 0;
  const id = () => "b" + (++counter).toString(36);
  for (const block of doc.blocks) {
    switch (block.t) {
      case "invocation":
      case "title":
      case "meta":
      case "heading":
        blocks.push({ id: id(), kind: block.t, text: block.text });
        break;
      case "para":
        blocks.push({ id: id(), kind: "para", text: htmlToMarkup(block.html.value), ...(block.center ? { center: true } : {}) });
        break;
      case "clauses":
        for (const item of block.items) blocks.push({ id: id(), kind: "clause", text: htmlToMarkup(item.value), numbered: block.style === "numbered" });
        break;
      case "list":
        for (const item of block.items) blocks.push({ id: id(), kind: "detail", text: htmlToMarkup(item.value) });
        break;
      case "table":
        blocks.push({ id: id(), kind: "locked", block: { t: "table", head: block.head, rows: block.rows.map((row) => row.map(plain)), widths: block.widths } });
        break;
      case "boundaries":
        blocks.push({ id: id(), kind: "locked", block: { t: "boundaries", head: block.head, rows: block.rows } });
        break;
      case "signatures":
        blocks.push({ id: id(), kind: "locked", block: { t: "signatures", items: block.items } });
        break;
      case "pagebreak":
        blocks.push({ id: id(), kind: "locked", block: { t: "pagebreak" } });
        break;
    }
  }
  return { language: doc.language, blocks };
}

/** Rebuilds renderable Blocks, grouping consecutive clauses and detail items. */
export function fromEditable(draft: EditableDraft): DraftDocument {
  const blocks: Block[] = [];
  for (const item of draft.blocks) {
    const last = blocks[blocks.length - 1];
    if (item.kind === "locked") {
      blocks.push(item.block);
    } else if (item.kind === "clause") {
      const style = item.numbered ? "numbered" : "plain";
      if (last?.t === "clauses" && (last.style ?? "plain") === style) last.items.push(markupToHtml(item.text));
      else blocks.push({ t: "clauses", style, items: [markupToHtml(item.text)] });
    } else if (item.kind === "detail") {
      if (last?.t === "list") last.items.push(markupToHtml(item.text));
      else blocks.push({ t: "list", items: [markupToHtml(item.text)] });
    } else if (item.kind === "para") {
      blocks.push({ t: "para", html: markupToHtml(item.text), ...(item.center ? { center: true } : {}) });
    } else {
      blocks.push({ t: item.kind, text: item.text });
    }
  }
  return { language: draft.language, blocks };
}

/** Plain text of a draft with block ids — what the AI sees when editing or reviewing. */
export function draftForAi(draft: EditableDraft) {
  return draft.blocks
    .filter((block): block is Extract<EditableBlock, { text: string }> => block.kind !== "locked")
    .map((block) => "[" + block.id + "] (" + block.kind + ") " + block.text)
    .join("\n");
}

/* ------------------------------------------------------------ AI edit ops */

export const editOperationSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("replace"), id: z.string().max(64), text: z.string().min(1).max(8000) }),
  z.object({ op: z.literal("insert_after"), id: z.string().max(64), kind: z.enum(["para", "clause", "detail", "heading"]).default("clause"), text: z.string().min(1).max(8000) }),
  z.object({ op: z.literal("delete"), id: z.string().max(64) }),
]);

export type EditOperation = z.infer<typeof editOperationSchema>;

/** Keeps only operations that target editable blocks that exist. */
export function validOperations(draft: EditableDraft, operations: unknown[]): EditOperation[] {
  const editable = new Set(draft.blocks.filter((block) => block.kind !== "locked").map((block) => block.id));
  return operations
    .map((operation) => editOperationSchema.safeParse(operation))
    .filter((result) => result.success)
    .map((result) => result.data as EditOperation)
    .filter((operation) => editable.has(operation.id))
    .slice(0, 40);
}

export function applyOperations(draft: EditableDraft, operations: EditOperation[]): EditableDraft {
  let blocks = [...draft.blocks];
  let counter = 0;
  for (const operation of operations) {
    const index = blocks.findIndex((block) => block.id === operation.id);
    if (index < 0) continue;
    const target = blocks[index];
    if (operation.op === "delete") {
      blocks = blocks.filter((block) => block.id !== operation.id);
    } else if (operation.op === "replace" && target.kind !== "locked") {
      blocks[index] = { ...target, text: operation.text };
    } else if (operation.op === "insert_after") {
      const numbered = target.kind === "clause" ? target.numbered : undefined;
      blocks.splice(index + 1, 0, { id: "ai" + Date.now().toString(36) + (++counter), kind: operation.kind, text: operation.text, ...(operation.kind === "clause" ? { numbered } : {}) });
    }
  }
  return { ...draft, blocks };
}
