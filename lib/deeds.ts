import type { Database } from "@/types/database";

export type DeedType = Database["public"]["Enums"]["deed_type"];
export type DeedStatus = Database["public"]["Enums"]["deed_status"];
export type DeedLanguage = Database["public"]["Enums"]["deed_language"];
export type DocumentCategory = Database["public"]["Enums"]["document_category"];

export const deedTypeLabels: Record<DeedType, string> = {
  sale: "Sale Deed",
  release: "Release Deed",
  gift: "Gift Deed",
  partition: "Partition Deed",
  will: "Will",
  other: "Other / Custom",
};

export const deedTypeDescriptions: Record<Exclude<DeedType, "other">, string> = {
  sale: "बिक्री दस्तावेज़ / Property transfer",
  release: "अधिकार त्याग / Release of rights",
  gift: "उपहार दस्तावेज़ / Gift transfer",
  partition: "बँटवारा दस्तावेज़ / Family partition",
  will: "वसीयत / Testamentary document",
};

export const statusLabels: Record<DeedStatus, string> = {
  draft: "Draft",
  data_collection: "Data collection",
  under_review: "Under review",
  generated: "Generated",
  finalized: "Finalized",
};

export const documentCategoryLabels: Record<DocumentCategory, string> = {
  naksha_map: "Naksha / Map",
  id_proof: "ID proof",
  prior_title_deed: "Prior title deed",
  jamabandi: "Jamabandi",
  payment_proof: "Payment proof",
  photograph: "Photograph",
  other: "Other",
};

export const documentCategories = Object.keys(
  documentCategoryLabels,
) as DocumentCategory[];

export const languageLabels: Record<DeedLanguage, string> = {
  english: "English",
  hindi: "Hindi",
  bilingual: "Bilingual",
};

type PartyRoleLabels = Record<"first" | "second" | "witness" | "other", string>;

const defaultRoles: PartyRoleLabels = {
  first: "First party",
  second: "Second party",
  witness: "Witness",
  other: "Confirming party",
};

export const partyRoleLabels: Record<DeedType, PartyRoleLabels> = {
  sale: { ...defaultRoles, first: "Seller (Vendor)", second: "Buyer (Vendee)" },
  release: { ...defaultRoles, first: "Releasor", second: "Releasee" },
  gift: { ...defaultRoles, first: "Donor", second: "Donee" },
  partition: { ...defaultRoles, first: "Co-sharer (first part)", second: "Co-sharer (other parts)" },
  will: { ...defaultRoles, first: "Testator", second: "Beneficiary", other: "Executor" },
  other: defaultRoles,
};

export const propertyKindLabels = {
  plot: "Residential plot",
  house: "House / building",
  flat: "Flat / apartment",
  shop: "Shop / commercial",
  agricultural: "Agricultural land",
  other: "Other",
} as const;

export const areaUnitLabels = {
  sq_ft: "sq. ft.",
  sq_yd: "sq. yd.",
  sq_m: "sq. m.",
  bigha: "bigha",
  hectare: "hectare",
  acre: "acre",
} as const;

export const paymentModeLabels = {
  cash: "Cash",
  cheque: "Cheque",
  rtgs_neft: "RTGS / NEFT",
  upi: "UPI",
  dd: "Demand draft",
  other: "Other",
} as const;

/** Deed types that carry a monetary consideration. */
export function hasConsideration(type: DeedType) {
  return type === "sale" || type === "release" || type === "other";
}

export const activityLabels: Record<string, string> = {
  created_deed: "Deed created",
  updated_title: "Title updated",
  changed_status: "Status changed",
  updated_remarks: "Remarks updated",
  duplicated_deed: "Deed duplicated",
  deleted_deed: "Deed deleted",
  uploaded_document: "Document uploaded",
  recategorized_document: "Document recategorised",
  deleted_document: "Document deleted",
  updated_parties: "Parties updated",
  updated_properties: "Properties updated",
  updated_payments: "Payments updated",
  updated_consideration: "Consideration updated",
  updated_firm_settings: "Firm settings updated",
  updated_profile: "Profile updated",
  seeded_demo_deed: "Demo deed added",
};

export function activityLabel(action: string) {
  return activityLabels[action] ?? action.replaceAll("_", " ");
}

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0, maximumFractionDigits: 2 });

export function formatINR(value: number | null | undefined) {
  return inr.format(value ?? 0);
}

const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function belowHundred(n: number) {
  return n < 20 ? ones[n] : tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
}

function belowThousand(n: number) {
  const hundred = Math.floor(n / 100);
  const rest = n % 100;
  return [hundred ? ones[hundred] + " Hundred" : "", rest ? belowHundred(rest) : ""].filter(Boolean).join(" ");
}

/** Converts an amount to Indian-system words, e.g. 2550000 → "Twenty Five Lakh Fifty Thousand". */
export function amountInWords(value: number) {
  let n = Math.floor(Math.abs(value));
  if (n === 0) return "Zero";
  const parts: string[] = [];
  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  if (crore) parts.push((crore >= 1000 ? amountInWords(crore) : belowThousand(crore)) + " Crore");
  if (lakh) parts.push(belowHundred(lakh) + " Lakh");
  if (thousand) parts.push(belowHundred(thousand) + " Thousand");
  if (n) parts.push(belowThousand(n));
  return parts.join(" ");
}
