import type { DraftLanguage } from "@/lib/deed-types";
import type { DeedData } from "@/lib/schemas/deed-data";

/**
 * Automatic script conversion for drafts. People type names and addresses in
 * whichever script they like; a Hindi draft needs them in Devanagari and an
 * English draft in Roman script. Converted values live in data.localized
 * (filled by AI, editable by the user) and are swapped in here, just before
 * drafting, so the drafting templates stay unchanged.
 */

const DEVANAGARI = /[ऀ-ॿ]/;
const LATIN = /[A-Za-z]/;

/** Codes and numbers stay as typed: "B-204", "P/2019/88", "SBI", "08ABCDE1234F1Z5". */
function isCode(value: string) {
  const text = value.trim();
  if (!/\s/.test(text) && /\d/.test(text)) return true;
  return /^[A-Z0-9./&-]{1,8}$/.test(text);
}

export function needsConversion(value: string | undefined | null, language: DraftLanguage): value is string {
  if (!value?.trim()) return false;
  if (language === "hindi") return LATIN.test(value) && !DEVANAGARI.test(value) && !isCode(value);
  return DEVANAGARI.test(value);
}

type Fields<T> = Array<keyof T & string>;

const partyFields: Fields<DeedData["parties"][number]> = ["fullName", "alias", "relativeName", "caste", "occupation", "address", "organisation", "capacity", "representedBy"];
const propertyFields: Fields<DeedData["properties"][number]> = ["description", "locality", "village", "tehsil", "district", "state", "north", "south", "east", "west", "construction", "constructionType", "road", "floor"];
const titleFields: Fields<DeedData["titleChain"][number]> = ["from", "office", "notes"];
const paymentFields: Fields<DeedData["payments"][number]> = ["bank", "lender", "notes"];
const termFields: Fields<DeedData["terms"]> = ["relationship", "share", "background", "purpose", "existingLoanBank", "buyerLoanBank", "jurisdiction", "additionalClauses"];
const executionFields: Fields<DeedData["execution"]> = ["place", "subRegistrarOffice"];

/** Multi-line values (e.g. extra clauses) are converted line by line so their layout survives. */
const lines = (value: unknown) => (typeof value === "string" ? value.split("\n").map((line) => line.trim()).filter(Boolean) : []);

function eachValue(data: DeedData, visit: (value: string) => void) {
  const walk = <T extends object>(item: T, fields: Array<keyof T & string>) => fields.forEach((field) => lines(item[field]).forEach(visit));
  data.parties.forEach((party) => walk(party, partyFields));
  data.properties.forEach((property) => walk(property, propertyFields));
  data.titleChain.forEach((entry) => walk(entry, titleFields));
  data.payments.forEach((payment) => walk(payment, paymentFields));
  walk(data.terms, termFields);
  walk(data.execution, executionFields);
}

/** Typed values that still need converting for this draft language. */
export function pendingConversions(data: DeedData, language: DraftLanguage, extra: string[] = []): string[] {
  const map = data.localized?.[language] ?? {};
  const out = new Set<string>();
  const visit = (value: string) => {
    if (needsConversion(value, language) && !(value in map)) out.add(value);
  };
  eachValue(data, visit);
  extra.forEach(visit);
  return [...out];
}

/** Every conversion currently used by this deed, for review and correction. */
export function usedConversions(data: DeedData, language: DraftLanguage, extra: string[] = []): Array<{ source: string; target: string }> {
  const map = data.localized?.[language] ?? {};
  const seen = new Set<string>();
  const out: Array<{ source: string; target: string }> = [];
  const visit = (value: string) => {
    if (needsConversion(value, language) && map[value] && !seen.has(value)) {
      seen.add(value);
      out.push({ source: value, target: map[value] });
    }
  };
  eachValue(data, visit);
  extra.forEach(visit);
  return out;
}

export function convertText(value: string | undefined, language: DraftLanguage, map: Record<string, string>): string | undefined {
  if (!value) return value;
  return value
    .split("\n")
    .map((line) => {
      const key = line.trim();
      return needsConversion(key, language) && map[key] ? map[key] : line;
    })
    .join("\n");
}

/** The deed data with typed values swapped for their converted form in this language. */
export function localizeData(data: DeedData, language: DraftLanguage): DeedData {
  const map = data.localized?.[language] ?? {};
  if (!Object.keys(map).length) return data;
  const convert = <T extends object>(item: T, fields: Array<keyof T & string>): T => {
    const copy = { ...item };
    for (const field of fields) {
      const value = copy[field];
      if (typeof value === "string") (copy as Record<string, unknown>)[field] = convertText(value, language, map);
    }
    return copy;
  };
  return {
    ...data,
    parties: data.parties.map((party) => convert(party, partyFields)),
    properties: data.properties.map((property) => convert(property, propertyFields)),
    titleChain: data.titleChain.map((entry) => convert(entry, titleFields)),
    payments: data.payments.map((payment) => convert(payment, paymentFields)),
    terms: convert(data.terms, termFields),
    execution: convert(data.execution, executionFields),
  };
}
