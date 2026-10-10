/**
 * Builds data/reference-drafts.json: anonymised texts of the real, registered
 * Rajasthan deeds in "Real Templates of Deeds", used by the AI as built-in
 * format references until a firm adds its own accepted drafts.
 *
 *   npm run references:build
 *
 * Calls Claude on Bedrock once per document (roughly $0.10–0.20 each). Results
 * are cached in node_modules/.cache so re-runs only process new files.
 */
import Module from "node:module";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

// lib/ modules import "server-only", which only resolves inside Next.js.
const loader = Module as unknown as { _resolveFilename: (request: string, ...rest: unknown[]) => string };
const resolve = loader._resolveFilename;
loader._resolveFilename = (request, ...rest) => (request === "server-only" ? require.resolve("./stub-server-only.cjs") : resolve(request, ...rest));

for (const line of existsSync(".env.local") ? readFileSync(".env.local", "utf8").split(/\r?\n/) : []) {
  const match = line.match(/^([A-Z_]+)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim();
}

const SOURCE = "Real Templates of Deeds";
const CACHE = path.join("node_modules", ".cache", "deeddraft-references.json");
const OUT = path.join("data", "reference-drafts.json");
const PER_TYPE = 3;

/** Duplicates, loan papers and superseded drafts are skipped. */
const skip = (name: string) => /\(\d\)\.(pdf|docx)$/i.test(name) || /^0075_|First_Draft|rakesh singh/i.test(name);

type Cached = { deedType: string; language: string; title: string; content: string };

async function main() {
  const { readReferenceDraft } = await import("../lib/ai/references.server");
  const files = readdirSync(SOURCE).filter((name) => /\.(pdf|docx)$/i.test(name) && !skip(name));
  const cache: Record<string, Cached> = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : {};
  const todo = files.filter((name) => !cache[name]);
  console.log("documents:", files.length, "| to read:", todo.length);

  let next = 0;
  const worker = async () => {
    while (next < todo.length) {
      const name = todo[next++];
      const started = Date.now();
      try {
        const bytes = new Uint8Array(readFileSync(path.join(SOURCE, name)));
        const mimeType = name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        const result = await readReferenceDraft({ bytes, mimeType, fileName: name });
        cache[name] = { deedType: result.deedType, language: result.language, title: result.title, content: result.content };
        mkdirSync(path.dirname(CACHE), { recursive: true });
        writeFileSync(CACHE, JSON.stringify(cache));
        console.log("✓", name, "→", result.deedType, result.language, result.content.length, "chars,", Math.round((Date.now() - started) / 1000) + "s,", result.usage.promptTokens, "in /", result.usage.completionTokens, "out");
      } catch (error) {
        console.log("✗", name, error instanceof Error ? error.message : error);
      }
    }
  };
  await Promise.all([worker(), worker(), worker()]);

  // Keep the most complete examples per deed type and language; no file names (they contain personal names).
  const groups = new Map<string, Cached[]>();
  for (const name of files) {
    const item = cache[name];
    // Certificates and cover pages are not drafts worth following.
    if (!item || item.deedType === "other" || item.content.length < 3000) continue;
    const key = item.deedType + ":" + item.language;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  const out = [...groups.entries()].flatMap(([, items]) =>
    items
      .sort((a, b) => b.content.length - a.content.length)
      .slice(0, PER_TYPE)
      .map((item, index) => ({ id: item.deedType + "-" + item.language + "-" + (index + 1), deedType: item.deedType, language: item.language, title: item.title, content: item.content })),
  );
  mkdirSync("data", { recursive: true });
  writeFileSync(OUT, JSON.stringify(out, null, 1));
  console.log("wrote", out.length, "references:", [...groups.keys()].map((key) => key + "×" + Math.min(PER_TYPE, groups.get(key)!.length)).join(", "));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
