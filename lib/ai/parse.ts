/**
 * Turns raw model output into validated DeedDraft data. Pure functions, no
 * network — covered by `npm test`. Model output is treated as untrusted input:
 * everything is normalised and re-validated with the zod schemas, and anything
 * that does not validate is dropped rather than saved.
 */

import { propertyKindHindi } from "@/lib/deeds";
import {
  paymentSchema,
  partySchema,
  propertySchema,
  titleEntrySchema,
  considerationSchema,
  type DeedData,
  type Party,
  type Payment,
  type Property,
  type TitleEntry,
} from "@/lib/schemas/deed-data";

export function parseJsonResponse(text: string): unknown {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        /* fall through */
      }
    }
    throw new Error("The AI response was not valid JSON.");
  }
}

type Loose = Record<string, unknown>;
const obj = (value: unknown): Loose => (value && typeof value === "object" && !Array.isArray(value) ? (value as Loose) : {});
const list = (value: unknown): Loose[] => (Array.isArray(value) ? value.map(obj) : []);
const str = (value: unknown) => (typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "");

/** "4,50,000/-", "Rs. 450000", 450000 → 450000 */
export function toNumber(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? value : undefined;
  const match = str(value).match(/\d[\d,]*(?:\.\d+)?/);
  if (!match) return undefined;
  const parsed = Number(match[0].replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** "26/07/2021", "26.07.2021", "2021-07-26" → "2021-07-26" */
export function toIsoDate(value: unknown): string {
  const text = str(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const match = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (!match) return "";
  const [, day, month, year] = match;
  const iso = year + "-" + month.padStart(2, "0") + "-" + day.padStart(2, "0");
  return Number.isNaN(Date.parse(iso)) ? "" : iso;
}

const relationMap: Record<string, Party["relation"]> = {
  "s/o": "S/o", son: "S/o", "पुत्र": "S/o", "सुपुत्र": "S/o",
  "d/o": "D/o", daughter: "D/o", "पुत्री": "D/o", "सुपुत्री": "D/o",
  "w/o": "W/o", wife: "W/o", "पत्नी": "W/o", "पत्नि": "W/o",
  "c/o": "C/o", "द्वारा": "C/o",
};

const unitMap: Record<string, Property["areaUnit"]> = {
  sq_ft: "sq_ft", "sq ft": "sq_ft", sqft: "sq_ft", "वर्गफुट": "sq_ft", "वर्ग फुट": "sq_ft",
  sq_yd: "sq_yd", "sq yd": "sq_yd", sqyd: "sq_yd", "वर्गगज": "sq_yd", "वर्ग गज": "sq_yd",
  sq_m: "sq_m", "sq m": "sq_m", sqm: "sq_m", "वर्गमीटर": "sq_m", "वर्ग मीटर": "sq_m",
  bigha: "bigha", "बीघा": "bigha", hectare: "hectare", "हैक्टेयर": "hectare", "हैक्टर": "hectare", acre: "acre", "एकड़": "acre",
};

const roles = new Set(["first", "second", "other", "witness"]);

function normaliseParty(raw: Loose): Party | null {
  const relation = relationMap[str(raw.relation).toLowerCase()] ?? "S/o";
  const genderText = str(raw.gender).toLowerCase();
  const gender = genderText === "female" || genderText === "f" || genderText === "महिला" || relation === "W/o" || relation === "D/o" ? "female" : "male";
  const parsed = partySchema.safeParse({
    id: crypto.randomUUID(),
    role: roles.has(str(raw.role)) ? str(raw.role) : "witness",
    fullName: str(raw.fullName),
    alias: str(raw.alias),
    gender,
    relation,
    relativeName: str(raw.relativeName),
    relativeDeceased: raw.relativeDeceased === true,
    age: toNumber(raw.age),
    caste: str(raw.caste),
    occupation: str(raw.occupation),
    address: str(raw.address),
    aadhaar: str(raw.aadhaar).replace(/\D/g, "").length === 12 ? str(raw.aadhaar).replace(/\D/g, "") : "",
    pan: /^[A-Z]{5}\d{4}[A-Z]$/i.test(str(raw.pan)) ? str(raw.pan).toUpperCase() : "",
    phone: str(raw.phone).slice(0, 20),
    organisation: str(raw.organisation),
  });
  return parsed.success ? parsed.data : null;
}

const kinds = new Set(["plot", "house", "flat", "shop", "office", "agricultural", "industrial", "other"]);
const uses = new Set(["residential", "commercial", "agricultural", "industrial", "mixed"]);

function normaliseProperty(raw: Loose): Property | null {
  const unit = unitMap[str(raw.areaUnit).toLowerCase()] ?? "sq_yd";
  const kind = (kinds.has(str(raw.kind)) ? str(raw.kind) : "other") as Property["kind"];
  const fallback = propertyKindHindi[kind] + (str(raw.identifier) ? " संख्या " + str(raw.identifier) : "");
  const parsed = propertySchema.safeParse({
    id: crypto.randomUUID(),
    kind,
    landUse: uses.has(str(raw.landUse)) ? str(raw.landUse) : "residential",
    description: str(raw.description).length >= 3 ? str(raw.description) : fallback,
    identifier: str(raw.identifier),
    khasra: str(raw.khasra),
    area: toNumber(raw.area),
    areaUnit: unit,
    locality: str(raw.locality),
    village: str(raw.village),
    tehsil: str(raw.tehsil),
    district: str(raw.district),
    state: str(raw.state),
    north: str(raw.north),
    south: str(raw.south),
    east: str(raw.east),
    west: str(raw.west),
    northSize: str(raw.northSize),
    southSize: str(raw.southSize),
    eastSize: str(raw.eastSize),
    westSize: str(raw.westSize),
    construction: str(raw.construction),
    constructionType: str(raw.constructionType),
    builtUpArea: toNumber(raw.builtUpArea),
    road: str(raw.road),
    corner: raw.corner === true,
    marketValue: toNumber(raw.marketValue),
  });
  return parsed.success ? parsed.data : null;
}

const instruments = new Set(["sale_deed", "patta", "allotment", "gift_deed", "rectification", "agreement_to_sell", "partition_deed", "release_deed", "will", "inheritance", "other"]);

function normaliseTitle(raw: Loose): TitleEntry | null {
  const parsed = titleEntrySchema.safeParse({
    id: crypto.randomUUID(),
    instrument: instruments.has(str(raw.instrument)) ? str(raw.instrument) : "other",
    date: toIsoDate(raw.date),
    from: str(raw.from),
    amount: toNumber(raw.amount),
    office: str(raw.office),
    book: str(raw.book) || "1",
    volume: str(raw.volume),
    page: str(raw.page),
    serial: str(raw.serial),
    addlVolume: str(raw.addlVolume),
    addlPages: str(raw.addlPages),
    pastedOn: toIsoDate(raw.pastedOn),
    notes: str(raw.notes),
  });
  return parsed.success ? parsed.data : null;
}

const modes = new Set(["cash", "cheque", "bankers_cheque", "dd", "rtgs_neft", "upi", "tds_challan", "other"]);
const natures = new Set(["earnest", "payment", "loan"]);

function normalisePayment(raw: Loose): Payment | null {
  const parsed = paymentSchema.safeParse({
    id: crypto.randomUUID(),
    mode: modes.has(str(raw.mode)) ? str(raw.mode) : "other",
    nature: natures.has(str(raw.nature)) ? str(raw.nature) : "payment",
    amount: toNumber(raw.amount),
    date: toIsoDate(raw.date),
    reference: str(raw.reference),
    bank: str(raw.bank),
    lender: str(raw.lender),
    notes: str(raw.notes),
  });
  return parsed.success ? parsed.data : null;
}

export type Extraction = Pick<DeedData, "parties" | "properties" | "titleChain" | "payments"> & {
  consideration: DeedData["consideration"];
  summary: string;
  warnings: string[];
};

const keep = <T,>(items: Array<T | null>) => items.filter((item): item is T => item !== null);

export function normaliseExtraction(value: unknown): Extraction {
  const raw = obj(value);
  const consideration = considerationSchema.safeParse({ total: toNumber(obj(raw.consideration).total), marketValue: toNumber(obj(raw.consideration).marketValue) });
  return {
    parties: keep(list(raw.parties).map(normaliseParty)).slice(0, 50),
    properties: keep(list(raw.properties).map(normaliseProperty)).slice(0, 25),
    titleChain: keep(list(raw.titleChain).map(normaliseTitle)).slice(0, 25),
    payments: keep(list(raw.payments).map(normalisePayment)).slice(0, 60),
    consideration: consideration.success ? consideration.data : {},
    summary: str(raw.summary).slice(0, 1000),
    warnings: (Array.isArray(raw.warnings) ? raw.warnings : []).map(str).filter(Boolean).slice(0, 20),
  };
}

export function normaliseClauses(value: unknown): string[] {
  return (Array.isArray(obj(value).clauses) ? (obj(value).clauses as unknown[]) : [])
    .map(str)
    .filter((clause) => clause.length > 5)
    .map((clause) => clause.replace(/\s*\n+\s*/g, " ").slice(0, 2000))
    .slice(0, 15);
}

export type ReviewIssue = { severity: "high" | "medium" | "low"; section: string; message: string };

export function normaliseReview(value: unknown): ReviewIssue[] {
  const severities = new Set(["high", "medium", "low"]);
  return list(obj(value).issues)
    .map((issue) => ({
      severity: (severities.has(str(issue.severity)) ? str(issue.severity) : "medium") as ReviewIssue["severity"],
      section: str(issue.section).slice(0, 40) || "general",
      message: str(issue.message).slice(0, 600),
    }))
    .filter((issue) => issue.message)
    .slice(0, 25);
}
