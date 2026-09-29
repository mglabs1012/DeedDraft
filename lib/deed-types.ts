import type { Database } from "@/types/database";

/**
 * Deed-type registry. Every screen (new-deed picker, tabs, checklists, templates
 * library) and the drafting engine read from here, so adding a deed category is
 * one entry below plus a template in lib/drafting/templates.
 */

export type DeedType = Database["public"]["Enums"]["deed_type"];
export type PartyRole = "first" | "second" | "other" | "witness";
export type SectionId = "parties" | "properties" | "title" | "payments" | "terms" | "documents";
export type DraftLanguage = "hindi" | "english";

/** Hindi role noun in its singular male/female and plural male/female forms. */
export type HindiTerm = { m: string; f: string; pm: string; pf: string };
export type RoleDef = { en: string; hi: HindiTerm };

export type DeedTypeConfig = {
  id: DeedType;
  label: string;
  labelHi: string;
  description: string;
  /** Heading printed on the draft. */
  heading: { hindi: string; english: string };
  roles: Record<PartyRole, RoleDef>;
  consideration: "required" | "optional" | "none";
  titleChain: "required" | "optional" | "none";
  /** Which kind of terms the Terms tab collects. */
  terms: "sale" | "agreement" | "gift" | "release" | "tenancy" | "family" | "none";
  /** Properties can be allotted to individual parties (partition / will). */
  allotment: boolean;
  languages: DraftLanguage[];
  defaultLanguage: "english" | "hindi" | "bilingual";
  highlights: string[];
};

const same = (word: string): HindiTerm => ({ m: word, f: word, pm: word + "गण", pf: word + "गण" });
const witness: RoleDef = { en: "Witness", hi: { m: "गवाह", f: "गवाह", pm: "गवाहान", pf: "गवाहान" } };
const seller: RoleDef = { en: "Seller (Vendor)", hi: { m: "विक्रेता", f: "विक्रेती", pm: "विक्रेतागण", pf: "विक्रेतीगण" } };
const buyer: RoleDef = { en: "Buyer (Vendee)", hi: { m: "क्रेता", f: "क्रेती", pm: "क्रेतागण", pf: "क्रेतीगण" } };
const confirming: RoleDef = { en: "Confirming party", hi: same("सहमतिदाता") };

export const deedTypes: Record<DeedType, DeedTypeConfig> = {
  sale: {
    id: "sale",
    label: "Sale Deed",
    labelHi: "विक्रय पत्र",
    description: "Absolute transfer of property for full consideration.",
    heading: { hindi: "विक्रय पत्र", english: "SALE DEED" },
    roles: { first: seller, second: buyer, other: confirming, witness },
    consideration: "required",
    titleChain: "required",
    terms: "sale",
    allotment: false,
    languages: ["hindi", "english"],
    defaultLanguage: "hindi",
    highlights: ["Chain of title with Sub-Registrar book, volume & page", "Consideration in words with cash / cheque / RTGS / loan / TDS recital", "Possession, mutation & indemnity clauses", "Schedule with boundaries and side measurements", "Area in sq. m. = sq. yd. = sq. ft."],
  },
  agreement_to_sell: {
    id: "agreement_to_sell",
    label: "Agreement to Sell",
    labelHi: "विक्रय इकरारनामा",
    description: "Earnest money now, sale deed on payment of balance.",
    heading: { hindi: "विक्रय इकरारनामा", english: "AGREEMENT TO SELL" },
    roles: { first: seller, second: buyer, other: confirming, witness },
    consideration: "required",
    titleChain: "required",
    terms: "agreement",
    allotment: false,
    languages: ["hindi", "english"],
    defaultLanguage: "hindi",
    highlights: ["Earnest money (साई) with payment modes", "Balance within a fixed period", "Forfeiture if buyer defaults", "Double earnest or specific performance if seller defaults", "Existing bank loan / NOC clause"],
  },
  gift: {
    id: "gift",
    label: "Gift Deed",
    labelHi: "दान पत्र",
    description: "Transfer out of natural love and affection, without consideration.",
    heading: { hindi: "दान-पत्र", english: "GIFT DEED" },
    roles: { first: { en: "Donor", hi: { m: "दानकर्त्ता", f: "दानकर्त्री", pm: "दानकर्त्तागण", pf: "दानकर्त्रीगण" } }, second: { en: "Donee", hi: same("दानग्रहिता") }, other: confirming, witness },
    consideration: "none",
    titleChain: "required",
    terms: "gift",
    allotment: false,
    languages: ["hindi", "english"],
    defaultLanguage: "hindi",
    highlights: ["Relationship between donor and donee", "No consideration, no conditions", "Acceptance and delivery of possession", "Mutation in all departments", "Witnesses as identifiers"],
  },
  release: {
    id: "release",
    label: "Release Deed",
    labelHi: "हक त्याग पत्र",
    description: "Relinquishment of a share in jointly held property.",
    heading: { hindi: "हक त्याग पत्र", english: "RELEASE DEED" },
    roles: { first: { en: "Releasor", hi: same("हकत्यागकर्ता") }, second: { en: "Releasee", hi: same("हकत्याग ग्रहिता") }, other: confirming, witness },
    consideration: "optional",
    titleChain: "optional",
    terms: "release",
    allotment: false,
    languages: ["hindi", "english"],
    defaultLanguage: "hindi",
    highlights: ["Share being released", "Optional consideration", "Sole ownership of releasee", "Mutation rights"],
  },
  partition: {
    id: "partition",
    label: "Partition Deed",
    labelHi: "विभाजन पत्र",
    description: "Division of jointly owned property by metes and bounds.",
    heading: { hindi: "विभाजन पत्र", english: "PARTITION DEED" },
    roles: { first: { en: "Co-owner (first part)", hi: same("सहस्वामी") }, second: { en: "Co-owner (other parts)", hi: same("सहस्वामी") }, other: confirming, witness },
    consideration: "none",
    titleChain: "optional",
    terms: "family",
    allotment: true,
    languages: ["hindi", "english"],
    defaultLanguage: "hindi",
    highlights: ["Joint ownership recital", "Allotment of each item to a party", "Exclusive possession of allotted portion", "Separate mutation"],
  },
  will: {
    id: "will",
    label: "Will",
    labelHi: "वसीयतनामा",
    description: "Testamentary disposition of property after death.",
    heading: { hindi: "वसीयतनामा", english: "LAST WILL AND TESTAMENT" },
    roles: {
      first: { en: "Testator", hi: { m: "वसीयतकर्ता", f: "वसीयतकर्त्री", pm: "वसीयतकर्तागण", pf: "वसीयतकर्त्रीगण" } },
      second: { en: "Beneficiary", hi: same("वसीयतग्राही") },
      other: { en: "Executor", hi: same("निष्पादक") },
      witness,
    },
    consideration: "none",
    titleChain: "optional",
    terms: "family",
    allotment: true,
    languages: ["hindi", "english"],
    defaultLanguage: "hindi",
    highlights: ["Sound mind declaration", "Revocation of earlier wills", "Bequest of each item to beneficiaries", "Executor appointment", "Attestation by two witnesses"],
  },
  lease: {
    id: "lease",
    label: "Lease Deed",
    labelHi: "पट्टा विलेख (लीज़)",
    description: "Long-term lease of commercial or residential premises.",
    heading: { hindi: "पट्टा विलेख", english: "LEASE DEED" },
    roles: { first: { en: "Lessor", hi: same("पट्टादाता") }, second: { en: "Lessee", hi: same("पट्टाग्रहीता") }, other: confirming, witness },
    consideration: "none",
    titleChain: "optional",
    terms: "tenancy",
    allotment: false,
    languages: ["english", "hindi"],
    defaultLanguage: "english",
    highlights: ["Lease term, lock-in and notice periods", "Fit-out (rent-free) period", "Year-wise rent schedule with escalation", "Interest-free refundable security deposit", "Utilities, taxes, arbitration and jurisdiction"],
  },
  rent: {
    id: "rent",
    label: "Rent Deed",
    labelHi: "किरायानामा",
    description: "Tenancy for a fixed term, usually 11 months.",
    heading: { hindi: "किरायानामा", english: "RENT AGREEMENT" },
    roles: { first: { en: "Tenant", hi: same("किरायेदार") }, second: { en: "Owner (Landlord)", hi: same("सम्पत्ति स्वामी") }, other: confirming, witness },
    consideration: "none",
    titleChain: "none",
    terms: "tenancy",
    allotment: false,
    languages: ["hindi", "english"],
    defaultLanguage: "hindi",
    highlights: ["Monthly rent, due date and bank account", "Fixed 11-month term with renewal", "Security deposit and adjustment", "No sub-letting or alterations without consent", "Exclusive jurisdiction and electronic notices"],
  },
  other: {
    id: "other",
    label: "Other / Custom",
    labelHi: "अन्य विलेख",
    description: "Custom instrument built from the matter details.",
    heading: { hindi: "विलेख", english: "DEED" },
    roles: { first: { en: "First party", hi: same("प्रथम पक्षकार") }, second: { en: "Second party", hi: same("द्वितीय पक्षकार") }, other: confirming, witness },
    consideration: "optional",
    titleChain: "optional",
    terms: "none",
    allotment: false,
    languages: ["hindi", "english"],
    defaultLanguage: "hindi",
    highlights: ["Parties and property schedule", "Free-form clauses"],
  },
};

export const deedTypeOrder: DeedType[] = ["sale", "agreement_to_sell", "gift", "release", "partition", "will", "lease", "rent", "other"];
export const deedTypeIds = deedTypeOrder as [DeedType, ...DeedType[]];

export function getDeedType(type: string): DeedTypeConfig {
  return deedTypes[type as DeedType] ?? deedTypes.other;
}

export function isDeedType(value: unknown): value is DeedType {
  return typeof value === "string" && value in deedTypes;
}

/** Tabs a deed of this type shows, in order. */
export function sectionsFor(type: DeedType): SectionId[] {
  const config = getDeedType(type);
  // Papers first: uploaded documents are read (OCR) and pre-fill the later steps.
  const sections: SectionId[] = ["documents", "parties", "properties"];
  if (config.titleChain !== "none") sections.push("title");
  if (config.consideration !== "none") sections.push("payments");
  sections.push("terms");
  return sections;
}
