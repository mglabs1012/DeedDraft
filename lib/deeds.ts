import { deedTypeOrder, deedTypes, getDeedType, type DeedType } from "@/lib/deed-types";
import type { Database } from "@/types/database";

export type { DeedType } from "@/lib/deed-types";
export type DeedStatus = Database["public"]["Enums"]["deed_status"];
export type DeedLanguage = Database["public"]["Enums"]["deed_language"];
export type DocumentCategory = Database["public"]["Enums"]["document_category"];

export const deedTypeLabels = Object.fromEntries(deedTypeOrder.map((type) => [type, deedTypes[type].label])) as Record<DeedType, string>;

export const deedTypeDescriptions = Object.fromEntries(
  deedTypeOrder.map((type) => [type, deedTypes[type].labelHi + " / " + deedTypes[type].description]),
) as Record<DeedType, string>;

export const partyRoleLabels = Object.fromEntries(
  deedTypeOrder.map((type) => [type, Object.fromEntries(Object.entries(deedTypes[type].roles).map(([role, def]) => [role, def.en]))]),
) as Record<DeedType, Record<"first" | "second" | "other" | "witness", string>>;

/** Deed types that carry a monetary consideration. */
export function hasConsideration(type: DeedType) {
  return getDeedType(type).consideration !== "none";
}

export const statusLabels: Record<DeedStatus, string> = {
  draft: "Draft",
  data_collection: "Data collection",
  under_review: "Under review",
  generated: "Generated",
  finalized: "Finalized",
};

export const documentCategoryLabels: Record<DocumentCategory, string> = {
  prior_title_deed: "Prior title deed",
  patta: "Patta / lease from authority",
  jamabandi: "Jamabandi",
  naksha_map: "Naksha / site plan",
  id_proof: "ID proof (Aadhaar / PAN)",
  payment_proof: "Payment proof",
  loan_papers: "Loan sanction / bank papers",
  stamp_paper: "e-Stamp / stamp paper",
  photograph: "Photograph",
  other: "Other",
};

export const documentCategories = Object.keys(documentCategoryLabels) as DocumentCategory[];

export const languageLabels: Record<DeedLanguage, string> = {
  english: "English",
  hindi: "Hindi",
  bilingual: "Bilingual",
};

export const propertyKindLabels = {
  plot: "Residential plot",
  house: "House / building",
  flat: "Flat / apartment",
  shop: "Shop / showroom",
  office: "Office premises",
  agricultural: "Agricultural land",
  industrial: "Industrial plot / shed",
  other: "Other",
} as const;

export const propertyKindHindi: Record<keyof typeof propertyKindLabels, string> = {
  plot: "भूखण्ड",
  house: "आवासीय सम्पत्ति",
  flat: "फ्लैट",
  shop: "दुकान",
  office: "कार्यालय परिसर",
  agricultural: "कृषि भूमि",
  industrial: "औद्योगिक भूखण्ड",
  other: "सम्पत्ति",
};

export const landUseLabels = {
  residential: "Residential",
  commercial: "Commercial",
  agricultural: "Agricultural",
  industrial: "Industrial",
  mixed: "Mixed use",
} as const;

export const landUseHindi: Record<keyof typeof landUseLabels, string> = {
  residential: "आवासीय",
  commercial: "व्यावसायिक",
  agricultural: "कृषि",
  industrial: "औद्योगिक",
  mixed: "मिश्रित",
};

export const areaUnitLabels = {
  sq_ft: "sq. ft.",
  sq_yd: "sq. yd.",
  sq_m: "sq. m.",
  bigha: "bigha",
  hectare: "hectare",
  acre: "acre",
} as const;

export const areaUnitHindi: Record<keyof typeof areaUnitLabels, string> = {
  sq_ft: "वर्गफुट",
  sq_yd: "वर्गगज",
  sq_m: "वर्गमीटर",
  bigha: "बीघा",
  hectare: "हैक्टेयर",
  acre: "एकड़",
};

export const paymentModeLabels = {
  cash: "Cash",
  cheque: "Cheque",
  bankers_cheque: "Banker's cheque",
  dd: "Demand draft",
  rtgs_neft: "RTGS / NEFT / IMPS",
  upi: "UPI",
  tds_challan: "TDS challan",
  other: "Other",
} as const;

export const paymentNatureLabels = {
  earnest: "Earnest money / advance (साई)",
  payment: "Consideration payment",
  loan: "Paid from buyer's bank loan",
} as const;

export const instrumentLabels = {
  sale_deed: "Registered sale deed",
  patta: "Patta / lease deed from authority",
  allotment: "Allotment letter",
  gift_deed: "Gift deed",
  rectification: "Rectification deed (शुद्धि पत्र)",
  agreement_to_sell: "Registered agreement to sell",
  partition_deed: "Partition deed",
  release_deed: "Release deed",
  will: "Will / probate",
  inheritance: "Inheritance (succession)",
  other: "Other instrument",
} as const;

export const instrumentHindi: Record<keyof typeof instrumentLabels, string> = {
  sale_deed: "रजिस्टर्ड विक्रय पत्र",
  patta: "पट्टा विलेख",
  allotment: "आवंटन पत्र",
  gift_deed: "रजिस्टर्ड दान पत्र",
  rectification: "शुद्धि पत्र विलेख",
  agreement_to_sell: "रजिस्टर्ड विक्रय इकरारनामा",
  partition_deed: "रजिस्टर्ड विभाजन पत्र",
  release_deed: "रजिस्टर्ड हक त्याग पत्र",
  will: "वसीयतनामा",
  inheritance: "उत्तराधिकार",
  other: "विलेख",
};

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
  updated_titleChain: "Chain of title updated",
  updated_payments: "Payments updated",
  updated_consideration: "Consideration updated",
  updated_terms: "Terms updated",
  updated_execution: "Execution details updated",
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
