import type { DraftInput } from "./common";

/** JSON with sorted keys and no undefined values, so the same facts always give the same text. */
function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return "[" + value.map((item) => (item === undefined ? "null" : stable(item))).join(",") + "]";
  return "{" + Object.keys(value).filter((key) => (value as Record<string, unknown>)[key] !== undefined).sort()
    .map((key) => JSON.stringify(key) + ":" + stable((value as Record<string, unknown>)[key])).join(",") + "}";
}

/**
 * Fingerprint of everything a generated draft is built from: deed type, title,
 * reference, firm and the matter facts (not uploads or workspace settings).
 * Stored on each draft version, so the draft view can tell when people,
 * property, payments or terms were corrected after the version was prepared.
 */
export function draftBasis(input: DraftInput): string {
  const { workspace: _workspace, custom: _custom, ...facts } = input.data; // eslint-disable-line @typescript-eslint/no-unused-vars
  const text = stable({ type: input.type, title: input.title, referenceNo: input.referenceNo, firmName: input.firmName, firmCity: input.firmCity, facts });
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    a = Math.imul(a ^ code, 0x01000193) >>> 0;
    b = Math.imul(b ^ code, 0x5bd1e995) >>> 0;
  }
  return a.toString(16).padStart(8, "0") + b.toString(16).padStart(8, "0") + text.length.toString(36);
}
