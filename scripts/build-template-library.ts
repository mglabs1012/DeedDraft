/**
 * Builds the searchable template library from the Word templates in
 * "Real Templates of Deeds/Agreements to Nivesh". Run after adding templates:
 *   npm run templates:build
 *
 * Writes:
 *   lib/templates/library-index.json  id, title, category, us flag (shipped to the UI)
 *   data/template-library/texts.json  cleaned template text by id (read on the server)
 */
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import mammoth from "mammoth";

import type { CategoryId, LibraryEntry } from "../lib/templates/catalog";

const SOURCE = path.join("Real Templates of Deeds", "Agreements to Nivesh");

/** Real executed deeds (personal data) and guides that are not templates. */
const EXCLUDE = new Set([
  "rakesh singh",
  "vikray patra 37b south",
  "faq about patents",
  "guide for buying and selling ip",
  "guide for trademark registration",
  "term sheet_important things to know about terms sheets",
  "e-commerce web site - comparaison matrix",
  "different option enclosed in the following pages",
  "web site rating worksheet",
  "investment analysis summary",
]);

/** Ordered rules: the first matching pattern decides the category. */
const RULES: Array<[CategoryId, RegExp]> = [
  ["poa", /power of attorne|attorney approval|appointment of an attorney/],
  ["affidavit", /affidavit|indemnity|indemnification|undertaking|\bbond\b|oath|perjury/],
  ["disputes", /arbitrat|conciliat|mediation/],
  ["rent", /tenancy/],
  ["company", /^resolution|^form no/],
  ["jobs", /at will|background check|employee|employment/],
  ["tech", /confidential|non\s?-?\s?disclosure|nondisclosure|non\s?-?\s?circumvention|reseller/],
  ["family", /\btrust\b|trustee|\bwill\b|codicil|testament|adoption|succession|probate|\bheirs?\b|inheritance|deed of partition|\bhuf\b|hindu|mohammedan|relinquish|deed of release|renunciation|death instructions|executor|guardian of minor|gift/],
  ["affidavit", /declaration/],
  ["company", /^form no|c\w*mpanies act|resolution|minutes|meeting|board approval|board of directors|directors?\b|articles|memorandum of association|by-?laws|incorporat|prospectus|stock|share certificate|shareholder|stockholder|esop|term sheet|proxy|corporat|dividend|debenture|auditor|share capital|^safe$|capitali[sz]ation|registers?$/],
  ["disputes", /arbitrat|conciliat|mediation|settlement|compromise|\baward\b|disputed account|abatement of litigation/],
  ["notices", /notice|\bsuit\b|petition|complaint|application under|application for a succession|order of reference|lis pendens|cease and desist|demand for|legal action|litigation|memorandum of appearance|decree/],
  ["company", /\bshares?\b|compan(y|ies)|subscription|convertible|nominee agreement/],
  ["business", /sell business|sale of (a |running )?business|business assets|bulk sale|purchase or sale of business|partnership interest/],
  ["rent", /\blease|leasing|\brent|rental|\btenan|landlord|sub-?lease|let a house|vacant|vacate|premises|attorn tenancy|security deposit|distraint|residency|studio use/],
  ["property", /sale deed|\bsell\b|purchase or sale of real|real estate|conveyance|immovable|agricultural land|flat buyer|builder|exchange|mortgage|right of way|encroachment|fence line|boundar|house raising|property|\bland\b|plot|quit claim|warranty deed|preemptor|option to (purchase|buy)|easement|excavate|owner maintenance/],
  ["jobs", /appointment(?! of (a |an )?(distributor|consultant))|employ|\bjob|apprentice|resignation|retirement|superannuation|termination|dismissal|probation|salary|hiring|recommendation|reference|interview|applicant|resume|personal secretary|lecturer|compassionate|welcome notices|handbook|manual$|helper|temporary help/],
  ["tech", /software|web ?site|internet|online|e-commerce|saas|domain|technology|technical manual|beta test|data recovery|source code|licen[cs]e|patent|trademark|tradename|copyright|\bip\b|trade secret|invention|proprietary|confidential|non-?\s?disclosure|nondisclosure|non-?\s?compete|non-solicit|restrictive covenants|chat room|virus|spam|privacy|multimedia|media|advertis|publicity|publication|publisher|author|illustrator|writer|broadcast|rerun|duplication|replication|talent|photo|testimonial|quote|press release|co-branding|linking|sponsorship|affiliate|promotional|product placement|personal appearance|contest/],
  ["workplace", /polic(y|ies)|rules|conduct|harassment|discrimination|leave|overtime|vacation|safety|smoking|drug|alcohol|polygraph|telecommut|jury duty|time off|disability plan|grievance|discipline|workplace|ethics|absence|tuition|travel and expense|checklist temporary/],
  ["money", /loan|promissory|\bnotes?\b|debt|credit|guarant|pledge|hypothecat|security agreement|security interest|collateral|instal+ment|payment|collection|cheque|\bcheck\b|bill of exchange|lending|borrow|finance|escrow|receipt|usury|draw request|bank|subordination|subrogation|repossession|pawn|\blien|wages|payroll|\bfund\b|lottery|fidelity/],
  ["business", /partner|franchis|distribut|agency|agent|dealer|reseller|sales|commission|consult|contract|services?\b|supply|goods|order|consignment|vending|catering|messenger|fleet|packaging|auction|broker|business|co-founder|joint|marketing|accountant|lawyer retainer|management agreement|maintenance agreement|bill of|quotation|proposal|\bbid\b|exchange agreement|purchase|seller|warranty|as is|salvage|vessel|fire extinguisher|charity|equipment|claim|insurance|utility|towing|lading/],
];

const US_TEXT = /\b(county|notary public|my commission expires|state of [a-z]|corporation|incorporat\w*|stockholders?|internal revenue|social security|u\.s\.|united states|dollars|llc|zip code|attorney at law)\b|\$\s?\d/i;
const US_TITLE = /soldier|sailor|at will|quit claim|warranty deed|incorporat|corporation|bylaws|by-laws|stock|irs\b|nuncupative|living trust|mechanic/;
const INDIA_TEXT = /\b(rs\.?|rupees|indian?|sub-registrar|s\/o|d\/o|w\/o|tehsil|delhi|mumbai|section \d+|act,? 1[89]\d\d|act,? 20\d\d|huf|hindu|mohammedan|stamp paper|lakhs?|crores?|panchayat)\b/i;

const SMALL = new Set(["a", "an", "and", "as", "at", "by", "for", "from", "in", "into", "of", "on", "or", "the", "to", "under", "with", "without", "its", "his", "her"]);
const UPPER = new Set(["huf", "noc", "ip", "nda", "esop", "ipc", "md", "it", "aids", "a.", "d.", "d.d.a", "saas", "safe", "llp", "pf"]);

function titleCase(text: string) {
  return text
    .toLowerCase()
    .split(" ")
    .map((word, index) => {
      if (UPPER.has(word)) return word === "saas" ? "SaaS" : word.toUpperCase();
      if (index > 0 && SMALL.has(word)) return word;
      return word.replace(/^(["'(\[]?)(\p{L})/u, (_, lead: string, letter: string) => lead + letter.toUpperCase());
    })
    .join(" ")
    .replace(/\bS\/o\b/gi, "S/o")
    .replace(/\bU\/s\b/g, "U/s")
    .replace(/\(Format 2\)/, "(Format 2)");
}

function normaliseName(file: string) {
  return path
    .basename(file, path.extname(file))
    .replace(/ /g, " ")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\.rtf$/i, "")
    .replace(/\bword\.?\s*draftt?\b/gi, "")
    .replace(/\s*\.?-1$/, "")
    .replace(/\(\d+\)/g, "")
    .replace(/\bagreemen\b/gi, "agreement")
    .replace(/\s+a$/i, " (format 2)")
    .replace(/\bus (\d)/gi, "u/s $1")
    .replace(/\b(agreemen|attorne|awar|manua|designate)1\b/gi, (_, stem: string) => stem + ({ agreemen: "t", attorne: "y", awar: "d", manua: "l", designate: "d" } as Record<string, string>)[stem.toLowerCase()])
    .replace(/\s+/g, " ")
    .trim();
}

function cleanText(raw: string) {
  const lines = raw.replace(/\r/g, "").split("\n").map((line) => line.replace(/[ \t ]+/g, " ").trim());
  const reviewAt = lines.findIndex((line) => /^review list$/i.test(line));
  const body = reviewAt > 0 ? lines.slice(0, reviewAt - (lines[reviewAt - 1] && lines[reviewAt - 1] === lines[reviewAt - 1].toUpperCase() ? 1 : 0)) : lines;
  const out: string[] = [];
  for (let line of body) {
    if (!line) continue;
    if (/^\[?\s*the rest of (this|the) page (has been |is )?intentionally left blank\.?\s*\]?$/i.test(line)) continue;
    if (/^[_\-=*~.\s]{45,}$/.test(line)) continue;
    line = line
      .replace(/(?:[.…_]\s?){4,}|…{2,}/g, " __________ ")
      .replace(/\s+([,.;:)])/g, "$1")
      .replace(/\s{2,}/g, " ")
      .trim();
    if (line && out[out.length - 1] !== line) out.push(line);
  }
  return out.join("\n");
}

function titleFromText(name: string, text: string) {
  const lines = text.split("\n");
  const first = lines[0] ?? "";
  const formNo = name.match(/^form no\.?\s*([0-9]+[a-z]*)/i);
  if (formNo) {
    const label = lines.slice(1, 6).find((line) => line.length >= 12 && line.length <= 110 && !/registration no|nominal capital|companies act|^\(see rule|^\[?form|^no\. of company|registration fee/i.test(line));
    return "Form No. " + formNo[1].toUpperCase() + (label ? " – " + label.replace(/[.:]+$/, "") : " (Companies Act)");
  }
  const generic = name.split(" ").length <= 1 || /^(deed|non|safe|utility|fund|landlord|tenant|notice|receipt|release|checklist|authorization|landlord's)$/i.test(name);
  const titleLike = first.length >= 3 && first.length <= 100 && first.replace(/[^A-Za-z]/g, "").length > 2 && first === first.toUpperCase();
  return generic && titleLike ? titleCase(first.replace(/[.:]+$/, "")) : titleCase(name);
}

function slug(text: string) {
  return text.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

function categorise(title: string): CategoryId {
  const key = title.toLowerCase();
  return RULES.find(([, pattern]) => pattern.test(key))?.[0] ?? "letters";
}

async function main() {
  const files: string[] = [];
  (function walk(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.docx$/i.test(entry.name)) files.push(full);
    }
  })(SOURCE);

  // Keep the most complete copy of each title (the same template appears in several folders).
  const best = new Map<string, { name: string; text: string }>();
  for (const file of files.sort()) {
    const name = normaliseName(file);
    const key = name.toLowerCase();
    if (EXCLUDE.has(key)) continue;
    const text = cleanText((await mammoth.extractRawText({ path: file })).value);
    if (text.length < 200) continue;
    const current = best.get(key);
    if (!current || text.length > current.text.length) best.set(key, { name, text });
  }

  const index: LibraryEntry[] = [];
  const texts: Record<string, string> = {};
  const seenText = new Set<string>();
  const ids = new Set<string>();
  for (const { name, text } of [...best.values()].sort((a, b) => a.name.localeCompare(b.name))) {
    const hash = createHash("sha1").update(text).digest("hex");
    if (seenText.has(hash)) continue;
    seenText.add(hash);
    const title = titleFromText(name, text);
    let id = slug(title) || "template";
    for (let n = 2; ids.has(id); n += 1) id = slug(title) + "-" + n;
    ids.add(id);
    const us = (US_TEXT.test(text) && !INDIA_TEXT.test(text)) || US_TITLE.test(title.toLowerCase());
    index.push({ id, title, category: categorise(title), ...(us ? { us: true } : {}) });
    texts[id] = text;
  }

  mkdirSync(path.join("data", "template-library"), { recursive: true });
  writeFileSync(path.join("lib", "templates", "library-index.json"), JSON.stringify(index));
  writeFileSync(path.join("data", "template-library", "texts.json"), JSON.stringify(texts));

  const counts = index.reduce<Record<string, number>>((all, entry) => ({ ...all, [entry.category]: (all[entry.category] ?? 0) + 1 }), {});
  console.log("templates:", index.length, "| US format:", index.filter((entry) => entry.us).length);
  console.log(Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([key, count]) => key + " " + count).join(" · "));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
