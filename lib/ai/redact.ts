/**
 * Identity numbers are swapped for tokens (⟦ID1⟧) before text is sent for AI
 * rewriting and swapped back afterwards. The model never sees the numbers and
 * cannot alter them.
 */

const PATTERNS = [
  /\b[2-9]\d{3}\s?\d{4}\s?\d{4}\b/g, // Aadhaar
  /\b[Xx*]{4}\s?[Xx*]{4}\s?\d{4}\b/g, // masked Aadhaar
  /\b[A-Z]{5}\d{4}[A-Z]\b/g, // PAN
  /\b\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]\b/g, // GSTIN
  /(?<!\d)(?:\+91[\s-]?)?[6-9]\d{9}(?!\d)/g, // mobile
];

export function createRedactor() {
  const byValue = new Map<string, string>();
  const byToken = new Map<string, string>();
  const redact = (text: string) =>
    PATTERNS.reduce(
      (out, pattern) =>
        out.replace(pattern, (match) => {
          let token = byValue.get(match);
          if (!token) {
            token = "⟦ID" + (byValue.size + 1) + "⟧";
            byValue.set(match, token);
            byToken.set(token, match);
          }
          return token;
        }),
      text,
    );
  const restore = (text: string) => text.replace(/⟦ID\d+⟧/g, (token) => byToken.get(token) ?? token);
  return { redact, restore, tokens: () => [...byToken.keys()] };
}
