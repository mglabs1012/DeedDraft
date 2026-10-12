/**
 * Final checks before a draft is printed or exported. Deterministic, instant and
 * free (no AI): they catch legal and data mistakes that forms alone do not —
 * minors signing, missing PAN on high-value sales, TDS, Will attestation,
 * unfilled blanks left in the draft, impossible dates and identity mix-ups.
 * Pure — covered by `npm test`.
 */

import { getDeedType, type DeedType, type SectionId } from "@/lib/deed-types";
import type { DeedData, Party } from "@/lib/schemas/deed-data";
import { isValidAadhaar } from "@/lib/text/aadhaar";

export type CheckSeverity = "error" | "warning";
export type FinalCheck = { id: string; severity: CheckSeverity; message: string; tab: SectionId };

const LAKH = 100_000;

/** Unfilled blanks in rendered draft text ("........", "____", "[नाम]"). */
export function countBlanks(text: string) {
  const dots = text.match(/\.{6,}|…{3,}/g)?.length ?? 0;
  const lines = text.match(/_{4,}/g)?.length ?? 0;
  const brackets = text.match(/\[(?:[^\]\n]{2,40})\]/g)?.length ?? 0;
  return dots + lines + brackets;
}

/** Plain text of a rendered draft (tags stripped, entities decoded). */
export function htmlToText(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<div class="draft">[\s\S]*?<\/div>/i, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

const digits = (value?: string) => (value ?? "").replace(/\D/g, "");
const label = (party: Party) => party.fullName || "A party";

function daysFromToday(iso: string, today: Date) {
  const date = new Date(iso + "T00:00:00");
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((date.getTime() - start.getTime()) / 86_400_000);
}

export function finalChecks(type: DeedType, data: DeedData, draftText = "", today = new Date()): FinalCheck[] {
  const config = getDeedType(type);
  const checks: FinalCheck[] = [];
  const add = (id: string, severity: CheckSeverity, message: string, tab: SectionId) => checks.push({ id, severity, message, tab });
  const first = data.parties.filter((party) => party.role === "first");
  const second = data.parties.filter((party) => party.role === "second");
  const witnesses = data.parties.filter((party) => party.role === "witness");
  const total = data.consideration.total ?? 0;
  const paid = data.payments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
  const firstTerm = config.roles.first.en.split(" (")[0].toLowerCase();
  const secondTerm = config.roles.second.en.split(" (")[0].toLowerCase();

  /* -- People */
  for (const party of first) {
    if (party.age !== undefined && party.age < 18 && type !== "rent") {
      add("minor-first-" + party.id, "error", label(party) + " is under 18. A minor cannot sign as " + firstTerm + "; a court-appointed guardian must act for them.", "parties");
    }
  }
  if (type === "rent") {
    for (const party of [...first, ...second]) if (party.age !== undefined && party.age < 18) add("minor-rent-" + party.id, "error", label(party) + " is under 18 and cannot sign a rent agreement.", "parties");
  } else if (type !== "will" && type !== "gift") {
    for (const party of second) if (party.age !== undefined && party.age < 18) add("minor-second-" + party.id, "warning", label(party) + " is under 18. As " + secondTerm + " they must act through a guardian — name the guardian in the deed.", "parties");
  }
  for (const party of witnesses) if (party.age !== undefined && party.age < 18) add("minor-witness-" + party.id, "warning", "Witness " + label(party) + " is under 18. Witnesses should be adults.", "parties");

  for (const party of data.parties) {
    if (party.aadhaar && digits(party.aadhaar).length === 12 && !isValidAadhaar(party.aadhaar)) add("aadhaar-" + party.id, "warning", "The Aadhaar number of " + label(party) + " fails the check-digit test. One digit is probably wrong.", "parties");
    if ((party.relation === "W/o" || party.relation === "D/o") && party.gender === "male") add("gender-" + party.id, "warning", label(party) + " is marked male but written as " + party.relation + ". Check gender or relation (it changes the Hindi wording).", "parties");
    if (party.age !== undefined && party.age > 110) add("age-" + party.id, "warning", "Age of " + label(party) + " (" + party.age + ") looks wrong.", "parties");
  }

  const seen = new Map<string, Party>();
  for (const party of data.parties) {
    for (const key of [digits(party.aadhaar).length === 12 ? "a" + digits(party.aadhaar) : "", party.pan ? "p" + party.pan.toUpperCase() : ""].filter(Boolean)) {
      const other = seen.get(key);
      if (other && other.id !== party.id) add("dup-" + key, "error", label(other) + " and " + label(party) + " have the same " + (key.startsWith("a") ? "Aadhaar" : "PAN") + " number.", "parties");
      else seen.set(key, party);
    }
  }
  const sameAcrossSides = first.find((a) => second.some((b) => a.fullName.trim() && a.fullName.trim() === b.fullName.trim() && (a.relativeName ?? "") === (b.relativeName ?? "")));
  if (sameAcrossSides) add("same-person", "warning", label(sameAcrossSides) + " appears as both " + firstTerm + " and " + secondTerm + ".", "parties");

  /* -- Legal requirements by deed type */
  if (type === "will" && witnesses.length < 2) add("will-witnesses", "error", "A Will must be attested by at least two witnesses (Indian Succession Act, s. 63).", "parties");
  if (type !== "will" && type !== "rent" && witnesses.length < 2) add("witnesses", "warning", "Registration offices expect two witnesses who can identify the parties.", "parties");

  if ((type === "sale" || type === "agreement_to_sell") && Math.max(total, data.consideration.marketValue ?? 0) > 10 * LAKH) {
    const noPan = [...first, ...second].filter((party) => !party.pan);
    if (noPan.length) add("pan-required", "warning", "PAN is required for property deals above ₹10 lakh (Income-tax Rule 114B). Missing for: " + noPan.map(label).join(", ") + ". Form 60 can be used if a party has no PAN.", "parties");
  }
  if (type === "sale" && Math.max(total, data.consideration.marketValue ?? 0) >= 50 * LAKH && !data.payments.some((payment) => payment.mode === "tds_challan")) {
    add("tds", "warning", "Consideration is ₹50 lakh or more: the buyer must deduct 1% TDS (s. 194-IA) and deposit it with Form 26QB. Add the TDS challan as a payment.", "payments");
  }
  if (config.consideration === "required" && total > 0 && paid > total) add("overpaid", "error", "Payments (₹" + paid.toLocaleString("en-IN") + ") are more than the total consideration (₹" + total.toLocaleString("en-IN") + ").", "payments");
  if (type === "sale" && total > 0 && paid > 0 && paid < total) add("underpaid", "warning", "Only ₹" + paid.toLocaleString("en-IN") + " of ₹" + total.toLocaleString("en-IN") + " is recorded as paid. A sale deed normally records the full price as received.", "payments");
  if (type === "sale" && data.consideration.marketValue && total && total < data.consideration.marketValue) add("below-dlc", "warning", "The price is below the DLC market value. Stamp duty is charged on the higher DLC value.", "payments");

  if ((type === "rent" || type === "lease") && (data.terms.termMonths ?? 0) > 12) add("rent-registration", "warning", "A " + (type === "rent" ? "rent agreement" : "lease") + " for more than one year must be registered (Registration Act, s. 17)" + (type === "rent" ? ". Keep it to 11 months or register it." : "."), "terms");
  if (type === "lease" && data.terms.securityDeposit && data.terms.monthlyRent && data.terms.securityDeposit > data.terms.monthlyRent * 12) add("deposit", "warning", "The security deposit is more than a year's rent. Check the amount.", "terms");

  /* -- Property */
  for (const property of data.properties) {
    if (!property.area) add("area-" + property.id, "warning", "Area is missing for " + (property.identifier || property.description || "a property") + ". Registration needs the area.", "properties");
  }

  /* -- Dates */
  if (data.execution.date) {
    const days = daysFromToday(data.execution.date, today);
    if (days < -120) add("date-old", "warning", "The execution date is more than four months ago. A document must be presented for registration within four months of signing (Registration Act, s. 23).", "terms");
    else if (days > 180) add("date-future", "warning", "The execution date is more than six months away. Check the year.", "terms");
  }
  if (type === "agreement_to_sell" && data.terms.balanceDueDate && data.execution.date && data.terms.balanceDueDate < data.execution.date) add("balance-date", "error", "The balance payment date is before the agreement date.", "terms");

  /* -- The draft text itself */
  if (draftText) {
    if (/\b(undefined|NaN|null)\b/.test(draftText)) add("broken-text", "error", "The draft contains a broken value (undefined / NaN). Re-check the fields and regenerate.", "parties");
    const blanks = countBlanks(draftText);
    if (blanks) add("blanks", "warning", blanks + " blank" + (blanks === 1 ? " is" : "s are") + " still empty in the draft (shown as dots or lines). Fill them in or complete them by hand before signing.", "terms");
  }

  return checks.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "error" ? -1 : 1));
}
