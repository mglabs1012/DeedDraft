import { about, careers, contact, help } from "./documents/company";
import { dataProtection } from "./documents/data-protection";
import { acceptableUse, cookies, disclaimer, grievance, privacyCentre, refunds } from "./documents/policies";
import { privacy } from "./documents/privacy";
import { terms } from "./documents/terms";
import type { LegalDoc } from "./types";

export { keyStatements, site } from "./site";
export type { LegalDoc } from "./types";

export const legalDocs = { terms, privacy, dataProtection, privacyCentre, cookies, disclaimer, refunds, acceptableUse, grievance, about, careers, help, contact } satisfies Record<string, LegalDoc>;

const link = (doc: LegalDoc, label = doc.title) => ({ href: "/" + doc.slug, label });

/** Footer columns, shown on the sign-in pages and every public page. */
export const footerGroups = [
  { title: "Company", links: [link(about, "About us"), link(careers), link(contact, "Contact"), link(help, "Help")] },
  { title: "Legal", links: [link(terms, "Terms of Service"), link(disclaimer), link(refunds, "Refund & Payments"), link(acceptableUse, "Acceptable Use")] },
  { title: "Privacy", links: [link(privacy, "Privacy Policy"), link(privacyCentre), link(dataProtection, "Data Protection (DPDP)"), link(cookies, "Cookies"), link(grievance, "Grievance Redressal")] },
];
