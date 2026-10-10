import { html, type Block } from "@/lib/drafting/blocks";
import type { AiEdit, DeedData } from "@/lib/schemas/deed-data";

/**
 * AI refinement works on numbered text segments of the standard draft instead
 * of rewriting the whole deed: the model returns only the edits (replace,
 * insert after, delete), which is much faster, keeps tables and signatures
 * intact and makes every change reviewable.
 */

export type Segment = { index: number; text: string; block: number; item?: number };

const unescape = (value: string) =>
  value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&amp;", "&");

export function blockSegments(blocks: Block[]): Segment[] {
  const out: Segment[] = [];
  blocks.forEach((block, blockIndex) => {
    if (block.t === "heading" || block.t === "title") out.push({ index: out.length, text: block.text, block: blockIndex });
    else if (block.t === "para") out.push({ index: out.length, text: unescape(block.html.value), block: blockIndex });
    else if (block.t === "clauses" || block.t === "list") block.items.forEach((item, itemIndex) => out.push({ index: out.length, text: unescape(item.value), block: blockIndex, item: itemIndex }));
  });
  return out;
}

const cell = (value: unknown) => (typeof value === "string" ? value : unescape(String((value as { value?: string })?.value ?? "")));

/**
 * The whole draft in reading order for the model: editable segments as
 * "[n] text" and fixed parts (boundary schedule, tables, signature blocks) as
 * "[fixed] …" so the model knows they exist and never adds a second copy.
 */
export function draftOutline(blocks: Block[], redact: (text: string) => string = (text) => text): string {
  const segments = blockSegments(blocks);
  const bySlot = new Map(segments.map((segment) => [segment.block + ":" + (segment.item ?? -1), segment]));
  const lines: string[] = [];
  blocks.forEach((block, blockIndex) => {
    if (block.t === "heading" || block.t === "title" || block.t === "para") {
      const segment = bySlot.get(blockIndex + ":-1")!;
      lines.push("[" + segment.index + "] " + redact(segment.text));
    } else if (block.t === "clauses" || block.t === "list") {
      block.items.forEach((_, itemIndex) => {
        const segment = bySlot.get(blockIndex + ":" + itemIndex)!;
        lines.push("[" + segment.index + "] " + redact(segment.text));
      });
    } else if (block.t === "boundaries") {
      lines.push("[fixed] Boundary schedule: " + redact(block.rows.map((row) => row.join(" / ")).join("; ")));
    } else if (block.t === "table") {
      lines.push("[fixed] Table: " + redact(block.rows.map((row) => row.map(cell).join(" | ")).join("; ").slice(0, 600)));
    } else if (block.t === "signatures") {
      lines.push("[fixed] Signature blocks: " + redact(block.items.map((item) => item.label + " (" + item.lines.join(", ") + ")").join("; ")));
    } else if (block.t === "invocation" || block.t === "meta") {
      lines.push("[fixed] " + redact(block.text));
    }
  });
  return lines.join("\n");
}

/** FNV-1a over the segment texts: identifies the exact standard draft an AI refinement was made for. */
export function hashSegments(segments: Segment[]) {
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (const segment of segments) {
    for (let i = 0; i < segment.text.length; i += 1) {
      const code = segment.text.charCodeAt(i);
      a = Math.imul(a ^ code, 0x01000193) >>> 0;
      b = Math.imul(b ^ code, 0x5bd1e995) >>> 0;
    }
    a = Math.imul(a ^ 0x1f, 0x01000193) >>> 0;
  }
  return a.toString(16).padStart(8, "0") + b.toString(16).padStart(8, "0") + segments.length.toString(16);
}

/** Applies validated edits to the blocks; tables, boundary schedules and signatures are untouched. */
export function applyEdits(blocks: Block[], edits: AiEdit[]): Block[] {
  const segments = blockSegments(blocks);
  const replace = new Map<number, string>();
  const remove = new Set<number>();
  const after = new Map<number, string[]>();
  for (const edit of edits) {
    if (edit.index < 0 || edit.index >= segments.length) continue;
    if (edit.op === "delete") remove.add(edit.index);
    else if (edit.op === "replace" && edit.text?.trim()) replace.set(edit.index, edit.text.trim());
    else if (edit.op === "insert_after" && edit.text?.trim()) after.set(edit.index, [...(after.get(edit.index) ?? []), edit.text.trim()]);
  }
  const bySlot = new Map(segments.map((segment) => [segment.block + ":" + (segment.item ?? -1), segment]));

  const out: Block[] = [];
  blocks.forEach((block, blockIndex) => {
    if (block.t === "heading" || block.t === "title" || block.t === "para") {
      const segment = bySlot.get(blockIndex + ":-1")!;
      if (!remove.has(segment.index)) {
        const text = replace.get(segment.index);
        if (text === undefined) out.push(block);
        else if (block.t === "para") out.push({ ...block, html: html`${text}` });
        else out.push({ ...block, text });
      }
      for (const extra of after.get(segment.index) ?? []) out.push({ t: "para", html: html`${extra}` });
      return;
    }
    if (block.t === "clauses" || block.t === "list") {
      const items = block.items.flatMap((item, itemIndex) => {
        const segment = bySlot.get(blockIndex + ":" + itemIndex)!;
        const kept = remove.has(segment.index) ? [] : [replace.has(segment.index) ? html`${replace.get(segment.index)}` : item];
        return [...kept, ...(after.get(segment.index) ?? []).map((extra) => html`${extra}`)];
      });
      if (items.length) out.push({ ...block, items });
      return;
    }
    out.push(block);
  });
  return out;
}

/** Digit groups in a text, ignoring thousands separators: "4,50,000" → "450000". */
export function numbersIn(text: string) {
  return (text.match(/\d[\d,./-]*\d|\d/g) ?? []).map((value) => value.replace(/,/g, ""));
}

/**
 * Particulars typed by the user (names, relations, occupations, castes, places,
 * boundaries, banks…) in the draft language. An AI edit may rephrase around
 * them but must keep each one that the original segment contained.
 */
export function protectedTerms(data: DeedData): string[] {
  const out = new Set<string>();
  const add = (value: string | undefined | null) => {
    for (const part of (value ?? "").split(/[,\n]/)) {
      const term = part.trim();
      if (term.length >= 3 && !/^\d+$/.test(term)) out.add(term);
    }
  };
  data.parties.forEach((party) => [party.fullName, party.alias, party.relativeName, party.occupation, party.caste, party.address, party.organisation].forEach(add));
  data.properties.forEach((property) => [property.identifier, property.khasra, property.village, property.locality, property.tehsil, property.district, property.north, property.south, property.east, property.west].forEach(add));
  data.titleChain.forEach((entry) => [entry.from, entry.office].forEach(add));
  data.payments.forEach((payment) => [payment.bank, payment.lender, payment.reference].forEach(add));
  return [...out];
}

export function keepsTerms(original: string, replacement: string, terms: string[]) {
  return terms.every((term) => !original.includes(term) || replacement.includes(term));
}

/**
 * A replacement may improve wording but must keep every number of the original
 * (amounts, dates, areas, plot and registration numbers).
 */
export function keepsParticulars(original: string, replacement: string) {
  const available = numbersIn(replacement).join(" ");
  return numbersIn(original).every((value) => available.includes(value));
}
