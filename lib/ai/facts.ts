import { getDeedType, type DeedType } from "@/lib/deed-types";
import type { DeedData } from "@/lib/schemas/deed-data";

/**
 * The matter as the AI should see it: only the sections and terms that apply
 * to this deed type. Defaults of unrelated sections (e.g. tenancy fields on a
 * sale deed) would otherwise read as real facts.
 */

const termGroups: Record<ReturnType<typeof getDeedType>["terms"], Array<keyof DeedData["terms"]>> = {
  sale: [],
  agreement: ["balanceDue", "balanceDueDate", "forfeitOnBuyerDefault", "sellerDefaultRemedy", "existingLoanBank", "buyerLoanBank"],
  gift: ["relationship", "background"],
  release: ["relationship", "share", "background"],
  family: ["relationship", "share", "background"],
  tenancy: ["purpose", "startDate", "termMonths", "monthlyRent", "rentDueDay", "rentAccount", "securityDeposit", "escalationPercent", "escalationEveryYears", "lockInMonths", "noticeMonths", "rentFreeDays", "utilitiesBy", "maintenanceBy", "propertyTaxBy", "jurisdiction", "arbitration"],
  none: [],
};

export function relevantFacts(type: DeedType, data: DeedData) {
  const config = getDeedType(type);
  const keys = [...termGroups[config.terms], "additionalClauses" as const];
  const terms = Object.fromEntries(keys.map((key) => [key, data.terms[key]]).filter(([, value]) => value !== undefined && value !== ""));
  return {
    parties: data.parties,
    properties: data.properties,
    ...(config.titleChain !== "none" ? { titleChain: data.titleChain } : {}),
    ...(config.consideration !== "none" ? { consideration: data.consideration, payments: data.payments } : {}),
    terms,
    execution: data.execution,
    ...(data.custom ? { form: { template: data.custom.title, answers: data.custom.answers } } : {}),
  };
}
