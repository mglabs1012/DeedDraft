import type { Block } from "./blocks";
import type { EditableDraft } from "./editable";

/**
 * Final repetition check: no clause may appear twice in a draft. Catches the
 * same clause typed again in "Additional clauses", added twice from the clause
 * library, or re-inserted by an AI edit — word for word or with trivial changes
 * (numbering, punctuation, bold marks, a few extra words).
 */

const unescape = (value: string) =>
  value
    .replace(/<[^>]+>/g, " ")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&amp;", "&");

/** Words of a clause without numbering, the "यह कि" / "That" lead-in, punctuation or bold marks. */
export function clauseWords(text: string): string[] {
  return text
    .replace(/\*\*/g, "")
    .toLowerCase()
    .replace(/^\s*(?:\(?\d+[.)]\s*)?(?:यह कि|that)\s+/u, "")
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

const numbers = (text: string) => (text.match(/\p{N}+/gu) ?? []).sort().join(" ");

/**
 * Same clause: identical words, or at least 8 words with 85% overlap and the
 * same numbers (so "plot No. 39" and "plot No. 40" are never merged).
 */
export function isSameClause(a: string, b: string) {
  const left = clauseWords(a);
  const right = clauseWords(b);
  if (!left.length || !right.length) return false;
  if (left.join(" ") === right.join(" ")) return true;
  if (Math.min(left.length, right.length) < 8 || numbers(a) !== numbers(b)) return false;
  const setA = new Set(left);
  const setB = new Set(right);
  let shared = 0;
  for (const word of setA) if (setB.has(word)) shared += 1;
  return shared / (setA.size + setB.size - shared) >= 0.85;
}

function firstDuplicate(seen: string[], text: string) {
  return seen.some((earlier) => isSameClause(earlier, text));
}

/**
 * Removes repeated clauses and paragraphs. Schedule detail lists repeat per
 * property by design ("not a corner property"), so lists, tables, boundaries
 * and signatures are left untouched.
 */
export function dedupeBlocks(blocks: Block[]): { blocks: Block[]; removed: string[] } {
  const seen: string[] = [];
  const removed: string[] = [];
  const out: Block[] = [];
  for (const block of blocks) {
    if (block.t === "clauses") {
      const items = block.items.filter((item) => {
        const text = unescape(item.value).trim();
        if (text && firstDuplicate(seen, text)) {
          removed.push(text);
          return false;
        }
        seen.push(text);
        return true;
      });
      if (items.length) out.push({ ...block, items });
    } else if (block.t === "para") {
      const text = unescape(block.html.value).trim();
      if (text && clauseWords(text).length >= 8 && firstDuplicate(seen, text)) {
        removed.push(text);
        continue;
      }
      seen.push(text);
      out.push(block);
    } else {
      out.push(block);
    }
  }
  return { blocks: out, removed };
}

/** The same check for an editable (studio / standard mode) draft. */
export function dedupeEditable(draft: EditableDraft): { draft: EditableDraft; removed: string[] } {
  const seen: string[] = [];
  const removed: string[] = [];
  const blocks = draft.blocks.filter((block) => {
    if (block.kind === "locked" || block.kind === "detail" || block.kind === "title" || block.kind === "heading" || block.kind === "invocation" || block.kind === "meta") return true;
    const text = block.text.trim();
    if (text && (block.kind !== "para" || clauseWords(text).length >= 8) && firstDuplicate(seen, text)) {
      removed.push(text);
      return false;
    }
    seen.push(text);
    return true;
  });
  return { draft: { ...draft, blocks }, removed };
}
