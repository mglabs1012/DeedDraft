import { getDeedType, type DeedType, type DraftLanguage, type SectionId } from "@/lib/deed-types";
import type { DeedData } from "@/lib/schemas/deed-data";

import { renderDraftHtml, type Block, type DraftDocument } from "./blocks";
import { createContext, paymentsTotal, type Ctx, type DraftInput } from "./common";
import { agreementToSell } from "./templates/agreement";
import { genericDeed, partitionDeed, releaseDeed, willDeed } from "./templates/family";
import { giftDeed } from "./templates/gift";
import { saleDeed } from "./templates/sale";
import { tenancyDeed } from "./templates/tenancy";

export { paymentsTotal } from "./common";
export { rentSchedule } from "./templates/tenancy";
export type { DraftInput } from "./common";
export type { Block, DraftDocument } from "./blocks";

const templates: Record<DeedType, (ctx: Ctx) => Block[]> = {
  sale: saleDeed,
  agreement_to_sell: agreementToSell,
  gift: giftDeed,
  release: releaseDeed,
  partition: partitionDeed,
  will: willDeed,
  lease: tenancyDeed,
  rent: tenancyDeed,
  other: genericDeed,
};

export type DraftChoice = DraftLanguage | "both";

/** Languages offered for a deed, with the matter's language preselected. */
export function draftChoices(type: DeedType): DraftChoice[] {
  const languages = getDeedType(type).languages;
  return languages.length > 1 ? [...languages, "both"] : languages;
}

export function defaultDraftChoice(type: DeedType, language: "english" | "hindi" | "bilingual"): DraftChoice {
  const choices = draftChoices(type);
  if (language === "bilingual" && choices.includes("both")) return "both";
  if (language !== "bilingual" && choices.includes(language)) return language;
  return choices[0];
}

export function buildDraftDocuments(input: DraftInput, choice: DraftChoice): DraftDocument[] {
  const languages: DraftLanguage[] = choice === "both" ? getDeedType(input.type).languages : [choice];
  return languages.map((language) => ({ language, blocks: templates[input.type](createContext(input, language)) }));
}

export function buildDraft(input: DraftInput, choice: DraftChoice) {
  const documents = buildDraftDocuments(input, choice);
  return {
    documents,
    html: renderDraftHtml({
      title: input.referenceNo + " · " + input.title,
      documents,
      footer: "Ref. " + input.referenceNo + " · Drafted by " + input.firmName + ", " + input.firmCity,
    }),
  };
}

/* --------------------------------------------------------------- Readiness */

export type ReadinessItem = { label: string; done: boolean; tab: SectionId; optional?: boolean };

export function getReadiness(type: DeedType, data: DeedData, documentCount: number): ReadinessItem[] {
  const config = getDeedType(type);
  const count = (role: "first" | "second" | "other" | "witness") => data.parties.filter((party) => party.role === role).length;
  const total = data.consideration.total ?? 0;
  const paid = paymentsTotal(data);
  const terms = data.terms;
  const items: ReadinessItem[] = [
    { label: "At least one " + config.roles.first.en.toLowerCase(), done: count("first") > 0, tab: "parties" },
    { label: "At least one " + config.roles.second.en.toLowerCase(), done: count("second") > 0, tab: "parties" },
    { label: "Property schedule added", done: data.properties.length > 0, tab: "properties" },
  ];

  if (data.properties.length) {
    items.push({ label: "Boundaries entered for every property", done: data.properties.every((property) => property.north && property.south && property.east && property.west), tab: "properties" });
  }
  if (config.allotment) {
    items.push({ label: "Every property allotted to a party", done: data.properties.length > 0 && data.properties.every((property) => property.allottedTo), tab: "properties" });
  }
  if (config.titleChain === "required") {
    items.push({ label: "Chain of title recorded", done: data.titleChain.length > 0, tab: "title" });
  }
  if (config.consideration === "required") {
    items.push({ label: "Total consideration entered", done: total > 0, tab: "payments" });
    if (type === "agreement_to_sell") {
      items.push(
        { label: "Earnest money recorded", done: paid > 0, tab: "payments" },
        { label: "Balance payment period set", done: Boolean(terms.balanceDue || terms.balanceDueDate), tab: "terms" },
      );
    } else {
      items.push({ label: "Payments cover the consideration", done: total > 0 && paid >= total, tab: "payments" });
    }
  }
  if (config.terms === "gift") items.push({ label: "Relationship of donor and donee", done: Boolean(terms.relationship), tab: "terms", optional: true });
  if (config.terms === "release") items.push({ label: "Share being released", done: Boolean(terms.share), tab: "terms", optional: true });
  if (config.terms === "tenancy") {
    items.push(
      { label: "Monthly rent entered", done: Boolean(terms.monthlyRent), tab: "terms" },
      { label: "Start date and term set", done: Boolean(terms.startDate && terms.termMonths), tab: "terms" },
      { label: "Security deposit recorded", done: Boolean(terms.securityDeposit), tab: "terms", optional: true },
    );
  }

  const principals = data.parties.filter((party) => party.role !== "witness");
  items.push(
    { label: "Age and address for every party", done: principals.length > 0 && principals.every((party) => party.age && party.address), tab: "parties", optional: true },
    { label: "Two witnesses named", done: count("witness") >= 2, tab: "parties", optional: true },
    { label: "Execution date set", done: Boolean(data.execution.date), tab: "terms", optional: true },
    { label: "Supporting documents uploaded", done: documentCount > 0, tab: "documents", optional: true },
  );
  return items;
}
