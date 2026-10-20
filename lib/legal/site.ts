/**
 * Who operates DeedDraft and how to reach them. Shown on every policy page.
 * Set the NEXT_PUBLIC_LEGAL_* variables in the environment before launch;
 * until then the pages show a clear "to be added" marker instead of a guess.
 */

const env = (value: string | undefined) => value?.trim() || "";

export const site = {
  name: "DeedDraft",
  operator: env(process.env.NEXT_PUBLIC_LEGAL_ENTITY) || "DeedDraft",
  address: env(process.env.NEXT_PUBLIC_LEGAL_ADDRESS) || "Ajmer, Rajasthan, India",
  email: env(process.env.NEXT_PUBLIC_CONTACT_EMAIL),
  grievanceOfficer: env(process.env.NEXT_PUBLIC_GRIEVANCE_OFFICER),
  grievanceEmail: env(process.env.NEXT_PUBLIC_GRIEVANCE_EMAIL) || env(process.env.NEXT_PUBLIC_CONTACT_EMAIL),
  /** Seat of arbitration and the only courts with jurisdiction. */
  seat: "Ajmer, Rajasthan",
  effectiveDate: "20 October 2026",
  /** Bump when the Terms or Disclaimer change: users are asked to accept again. */
  version: "2026-10-20",
};

const missing = "[to be added]";
export const contactEmail = () => site.email || "the email address on our Contact page " + missing;
export const grievanceContact = () =>
  (site.grievanceOfficer || "The Grievance Officer " + missing) + ", " + site.operator + ", " + site.address + (site.grievanceEmail ? ", email: " + site.grievanceEmail : "");

/** Statements that appear on every page, in the same words, so they are never missed. */
export const keyStatements = {
  consent:
    "Every deed, property paper, identity document or other file you upload to DeedDraft must be uploaded with the consent of the person (or persons) to whom the document and the personal data in it belong. By uploading, you confirm that you have that consent and the legal right to share the document with us.",
  noGuarantee:
    "We do not give any guarantee or warranty about any data — including its accuracy, completeness, availability, confidentiality or safety from loss. Always keep your own copies of every document and draft.",
  advocateCheck:
    "DeedDraft is a drafting tool, not a law firm, and does not give legal advice. Every document must be checked by an advocate before it is signed or presented before the Sub-Registrar or any other authority.",
  jurisdiction:
    "Any dispute is settled by arbitration seated at Ajmer, Rajasthan. If a dispute cannot be resolved through arbitration, the courts at Ajmer, Rajasthan alone have jurisdiction.",
};
