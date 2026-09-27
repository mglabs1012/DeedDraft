import {
  amountInWords,
  areaUnitHindi,
  areaUnitLabels,
  landUseHindi,
  landUseLabels,
  propertyKindHindi,
  propertyKindLabels,
} from "@/lib/deeds";
import type { HindiTerm } from "@/lib/deed-types";
import type { Party, Property } from "@/lib/schemas/deed-data";

import { b, html, join, type SafeHtml } from "./blocks";
import { hindiWords } from "./hindi";

/* ------------------------------------------------------------------ Money */

const grouping = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });

/** "4,50,000/-" */
export function figure(value?: number) {
  return value ? grouping.format(value) + "/-" : "............/-";
}

/** "4,50,000/- अक्षरे चार लाख पचास हजार रूपये मात्र" */
export function moneyHi(value?: number) {
  return value ? figure(value) + " अक्षरे " + hindiWords(value) + " रूपये मात्र" : "............/- अक्षरे .............................. रूपये मात्र";
}

/** "Rs. 4,50,000/- (Rupees Four Lakh Fifty Thousand Only)" */
export function moneyEn(value?: number) {
  return value ? "Rs. " + figure(value) + " (Rupees " + amountInWords(value) + " Only)" : "Rs. ____________/- (Rupees ____________________ Only)";
}

/* ------------------------------------------------------------------- Area */

const squareMetres: Partial<Record<Property["areaUnit"], number>> = {
  sq_ft: 0.09290304,
  sq_yd: 0.83612736,
  sq_m: 1,
  hectare: 10000,
  acre: 4046.8564224,
};

const round = (value: number) => grouping.format(Math.round(value * 100) / 100);

export function areaShort(property: Property, lang: "hindi" | "english") {
  if (!property.area) return "";
  const unit = lang === "hindi" ? areaUnitHindi[property.areaUnit] : areaUnitLabels[property.areaUnit];
  return round(property.area) + " " + unit;
}

/** "82.33 वर्गमीटर = 98.47 वर्गगज = 886.23 वर्गफुट" as written in Rajasthan deeds. */
export function areaTriple(property: Property, lang: "hindi" | "english") {
  if (!property.area) return "";
  const factor = squareMetres[property.areaUnit];
  if (!factor) return areaShort(property, lang);
  const sqm = property.area * factor;
  const labels = lang === "hindi" ? ["वर्गमीटर", "वर्गगज", "वर्गफुट"] : ["sq. m.", "sq. yd.", "sq. ft."];
  const triple = [round(sqm) + " " + labels[0], round(sqm / 0.83612736) + " " + labels[1], round(sqm / 0.09290304) + " " + labels[2]].join(" = ");
  return property.areaUnit === "hectare" || property.areaUnit === "acre" ? areaShort(property, lang) + " (" + triple + ")" : triple;
}

/* --------------------------------------------------------------- Parties */

export type IdOptions = { ids?: boolean; maskAadhaar?: boolean };

export function formatAadhaar(value: string | undefined, mask = false) {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.length !== 12) return "";
  return mask ? "XXXX XXXX " + digits.slice(8) : digits.replace(/(\d{4})(\d{4})(\d{4})/, "$1 $2 $3");
}

export function isFemale(party: Party) {
  return party.gender === "female";
}

/** Picks the singular/plural, male/female Hindi role noun for a group of parties. */
export function hindiTerm(term: HindiTerm, parties: Party[]) {
  if (parties.length > 1) return parties.every(isFemale) ? term.pf : term.pm;
  return parties[0] && isFemale(parties[0]) ? term.f : term.m;
}

/** Verb/adjective agreement: singular male, singular female, plural. */
export function agree(parties: Party[], male: string, female: string, plural: string) {
  if (parties.length > 1) return plural;
  return parties[0] && isFemale(parties[0]) ? female : male;
}

const hindiSalutations = { shri: "श्री", smt: "श्रीमती", sushri: "सुश्री", kumari: "कुमारी", none: "" } as const;
const englishSalutations = { shri: "Shri", smt: "Smt.", sushri: "Ms.", kumari: "Kumari", none: "" } as const;
const hindiRelations = { "S/o": "पुत्र", "D/o": "पुत्री", "W/o": "पत्नी", "C/o": "द्वारा" } as const;

export function salutation(party: Party, lang: "hindi" | "english") {
  const table = lang === "hindi" ? hindiSalutations : englishSalutations;
  if (party.salutation && party.salutation !== "auto") return table[party.salutation];
  return isFemale(party) ? table.smt : table.shri;
}

export function displayName(party: Party, lang: "hindi" | "english") {
  return [salutation(party, lang), party.fullName].filter(Boolean).join(" ");
}

export function relativeHi(party: Party) {
  if (!party.relativeName) return "";
  if (party.relation === "C/o") return "द्वारा " + party.relativeName;
  return hindiRelations[party.relation] + " " + (party.relativeDeceased ? "स्व. श्री " : "श्री ") + party.relativeName;
}

export function relativeEn(party: Party) {
  if (!party.relativeName) return "";
  return party.relation + " " + (party.relativeDeceased ? "Late " : "") + "Shri " + party.relativeName;
}

export function partyHi(party: Party, options: IdOptions = {}): SafeHtml {
  const person = [
    b(displayName(party, "hindi") + (party.alias ? " उर्फ " + party.alias : "")),
    relativeHi(party),
    party.caste ? "जाति " + party.caste : "",
    party.age ? "आयु " + party.age + " वर्ष" : "",
    party.occupation ? "व्यवसाय " + party.occupation : "",
    party.address ? "निवासी " + party.address : "",
  ].filter(Boolean);
  const ids = options.ids
    ? [formatAadhaar(party.aadhaar, options.maskAadhaar) ? "आधार नम्बर " + formatAadhaar(party.aadhaar, options.maskAadhaar) : "", party.pan ? "पैन नम्बर " + party.pan : ""].filter(Boolean)
    : [];
  const body = join(person as Array<SafeHtml | string>, ", ");
  const organisation = party.organisation
    ? html`मैसर्स ${b(party.organisation)}${party.gstin ? html` (जी.एस.टी.आई.एन. ${party.gstin})` : ""}, जरिये ${party.capacity || "अधिकृत प्रतिनिधि"} `
    : "";
  return html`${organisation}${body}${ids.length ? html` (${ids.join(", ")})` : ""}${party.representedBy ? html` (जरिये ${party.representedBy})` : ""}`;
}

export function partyEn(party: Party, options: IdOptions = {}): SafeHtml {
  const person = [
    b(displayName(party, "english") + (party.alias ? " alias " + party.alias : "")),
    relativeEn(party),
    party.age ? "aged about " + party.age + " years" : "",
    party.occupation ? "Occupation: " + party.occupation : "",
    party.address ? "residing at " + party.address : "",
  ].filter(Boolean);
  const ids = options.ids
    ? [formatAadhaar(party.aadhaar, options.maskAadhaar) ? "Aadhaar No. " + formatAadhaar(party.aadhaar, options.maskAadhaar) : "", party.pan ? "PAN " + party.pan : "", party.gstin ? "GSTIN " + party.gstin : ""].filter(Boolean)
    : [];
  const organisation = party.organisation ? html`${b("M/s. " + party.organisation)}, through its ${party.capacity || "authorised signatory"} ` : "";
  return html`${organisation}${join(person as Array<SafeHtml | string>, ", ")}${ids.length ? html` (${ids.join(", ")})` : ""}${party.representedBy ? html` (represented by ${party.representedBy})` : ""}`;
}

/** One party inline, several as (1) … (2) … */
export function partyList(parties: Party[], lang: "hindi" | "english", options: IdOptions = {}) {
  const describe = lang === "hindi" ? partyHi : partyEn;
  if (!parties.length) return html`${lang === "hindi" ? "......................................................" : "__________________________"}`;
  if (parties.length === 1) return describe(parties[0], options);
  return join(parties.map((party, index) => html`(${index + 1}) ${describe(party, options)}`), " ");
}

/* ------------------------------------------------------------ Properties */

export function kindHi(property: Property) {
  return propertyKindHindi[property.kind];
}

function placeHi(property: Property) {
  const sameTehsil = property.tehsil && property.district && property.tehsil === property.district;
  return [
    property.locality,
    property.village && !property.khasra ? "ग्राम " + property.village : property.village ? "राजस्व ग्राम " + property.village : "",
    sameTehsil ? "तहसील व जिला " + property.district : [property.tehsil ? "तहसील " + property.tehsil : "", property.district ? "जिला " + property.district : ""].filter(Boolean).join(", "),
  ]
    .filter(Boolean)
    .join(", ") + (property.state ? " (" + property.state + ")" : "");
}

function placeEn(property: Property) {
  const sameTehsil = property.tehsil && property.district && property.tehsil === property.district;
  return [
    property.locality,
    property.village ? "Village " + property.village : "",
    sameTehsil ? "Tehsil & District " + property.district : [property.tehsil ? "Tehsil " + property.tehsil : "", property.district ? "District " + property.district : ""].filter(Boolean).join(", "),
    property.state,
  ]
    .filter(Boolean)
    .join(", ");
}

/** "भूखण्ड संख्या 39, जो राजस्व ग्राम बडगांव के खसरा नम्बर 569 की भूमि का भाग है, जिसका कुल क्षेत्रफल 98.47 वर्गगज है, जो वाके … में स्थित है" */
export function propertyHi(property: Property, withDescription = false) {
  const head = property.identifier
    ? kindHi(property) + " संख्या " + property.identifier + (withDescription && property.description ? " (" + property.description + ")" : "")
    : property.description;
  const khasra = property.khasra ? ", जो " + (property.village ? "राजस्व ग्राम " + property.village + " के " : "") + "खसरा नम्बर " + property.khasra + " की भूमि का भाग है" : "";
  const area = property.area ? ", जिसका कुल क्षेत्रफल " + areaShort(property, "hindi") + " है" : "";
  const place = placeHi(property).trim();
  return head + khasra + area + (place ? ", जो वाके " + place + " में स्थित है" : "");
}

export function propertyEn(property: Property, withDescription = false) {
  const head = property.identifier
    ? propertyKindLabels[property.kind] + " No. " + property.identifier + (withDescription && property.description ? " (" + property.description + ")" : "")
    : property.description;
  const khasra = property.khasra ? ", forming part of Khasra No. " + property.khasra + (property.village ? " of revenue village " + property.village : "") : "";
  const area = property.area ? ", admeasuring " + areaShort(property, "english") : "";
  const place = placeEn(property);
  return head + khasra + area + (place ? ", situated at " + place : "");
}

export function landUse(property: Property, lang: "hindi" | "english") {
  return lang === "hindi" ? landUseHindi[property.landUse] : landUseLabels[property.landUse].toLowerCase();
}

/** Short reference for the property/properties in recitals. */
export function propertiesRef(properties: Property[], lang: "hindi" | "english") {
  if (!properties.length) return lang === "hindi" ? "निम्नवर्णित सम्पत्ति" : "the property described in the Schedule";
  if (properties.length > 1) return lang === "hindi" ? "निम्नवर्णित सम्पत्तियाँ" : "the properties described in the Schedule";
  return lang === "hindi" ? "उक्त वर्णित " + kindHi(properties[0]) : "the said " + propertyKindLabels[properties[0].kind].toLowerCase();
}
