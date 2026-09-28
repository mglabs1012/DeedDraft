import { z } from "zod";

/**
 * Structured matter data stored in deeds.data (JSONB). This is the single contract
 * shared by the editors, the drafting engine and — later — AI extraction, so every
 * field is optional or defaulted and old records keep parsing.
 */

export const DEED_DATA_VERSION = 2;

const text = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));
const date = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date.")
  .optional()
  .or(z.literal(""));

const optionalNumber = z.preprocess(
  (value) =>
    value === "" || value === null || value === undefined || (typeof value === "number" && Number.isNaN(value))
      ? undefined
      : Number(value),
  z.number({ invalid_type_error: "Enter a number." }).nonnegative("Must be zero or more.").optional(),
);

/* ----------------------------------------------------------------- Parties */

export const partyRoleSchema = z.enum(["first", "second", "witness", "other"]);
export const relationSchema = z.enum(["S/o", "D/o", "W/o", "C/o"]);
export const genderSchema = z.enum(["male", "female"]);
export const salutationSchema = z.enum(["auto", "shri", "smt", "sushri", "kumari", "none"]);

export const partySchema = z.object({
  id: z.string().min(1).max(64),
  role: partyRoleSchema,
  salutation: salutationSchema.default("auto"),
  fullName: z.string().trim().min(2, "Enter the full name.").max(160),
  alias: text(160),
  gender: genderSchema.default("male"),
  relation: relationSchema,
  relativeName: text(160),
  relativeDeceased: z.boolean().default(false),
  age: optionalNumber,
  caste: text(60),
  occupation: text(80),
  address: text(500),
  aadhaar: z
    .string()
    .trim()
    .regex(/^\d{4}\s?\d{4}\s?\d{4}$/, "Aadhaar must be 12 digits.")
    .optional()
    .or(z.literal("")),
  pan: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{5}\d{4}[A-Z]$/, "PAN format is ABCDE1234F.")
    .optional()
    .or(z.literal("")),
  phone: text(20),
  email: z.string().trim().email("Enter a valid email.").max(254).optional().or(z.literal("")),
  organisation: text(200),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/, "GSTIN must be 15 characters, e.g. 08ABCDE1234F1Z5.")
    .optional()
    .or(z.literal("")),
  capacity: text(120),
  representedBy: text(600),
});

/* -------------------------------------------------------------- Properties */

export const propertyKindSchema = z.enum(["plot", "house", "flat", "shop", "office", "agricultural", "industrial", "other"]);
export const areaUnitSchema = z.enum(["sq_ft", "sq_yd", "sq_m", "bigha", "hectare", "acre"]);
export const landUseSchema = z.enum(["residential", "commercial", "agricultural", "industrial", "mixed"]);

export const propertySchema = z.object({
  id: z.string().min(1).max(64),
  kind: propertyKindSchema,
  landUse: landUseSchema.default("residential"),
  description: z.string().trim().min(3, "Describe the property.").max(1000),
  identifier: text(160),
  khasra: text(160),
  area: optionalNumber,
  areaUnit: areaUnitSchema,
  locality: text(200),
  village: text(120),
  tehsil: text(80),
  district: text(80),
  state: text(80),
  north: text(200),
  south: text(200),
  east: text(200),
  west: text(200),
  northSize: text(40),
  southSize: text(40),
  eastSize: text(40),
  westSize: text(40),
  construction: text(1500),
  constructionType: text(80),
  builtUpArea: optionalNumber,
  constructionYear: text(20),
  road: text(160),
  corner: z.boolean().default(false),
  marketValue: optionalNumber,
  allottedTo: text(64),
});

/* ---------------------------------------------------------- Chain of title */

export const instrumentSchema = z.enum([
  "sale_deed",
  "patta",
  "allotment",
  "gift_deed",
  "rectification",
  "agreement_to_sell",
  "partition_deed",
  "release_deed",
  "will",
  "inheritance",
  "other",
]);

export const titleEntrySchema = z.object({
  id: z.string().min(1).max(64),
  instrument: instrumentSchema,
  date,
  from: text(400),
  amount: optionalNumber,
  office: text(120),
  book: text(10),
  volume: text(20),
  page: text(20),
  serial: text(40),
  addlVolume: text(20),
  addlPages: text(40),
  pastedOn: date,
  notes: text(800),
});

/* ---------------------------------------------------- Consideration & payments */

export const paymentModeSchema = z.enum(["cash", "cheque", "bankers_cheque", "dd", "rtgs_neft", "upi", "tds_challan", "other"]);
export const paymentNatureSchema = z.enum(["earnest", "payment", "loan"]);

export const paymentSchema = z.object({
  id: z.string().min(1).max(64),
  mode: paymentModeSchema,
  nature: paymentNatureSchema.default("payment"),
  amount: z.preprocess(
    (value) => (value === "" || value === undefined ? undefined : Number(value)),
    z.number({ required_error: "Enter an amount.", invalid_type_error: "Enter an amount." }).positive("Amount must be more than zero."),
  ),
  date,
  reference: text(80),
  bank: text(200),
  lender: text(200),
  notes: text(300),
});

export const stampCategorySchema = z.enum(["male", "female", "female_reserved"]);

export const considerationSchema = z.object({
  total: optionalNumber,
  marketValue: optionalNumber,
  stampDuty: optionalNumber,
  registrationFee: optionalNumber,
  stampCategory: stampCategorySchema.optional(),
});

/* ------------------------------------------------------------------- Terms */

export const byPartySchema = z.enum(["first", "second"]);

export const termsSchema = z.object({
  // gift / release / family
  relationship: text(200),
  share: text(300),
  background: text(1500),
  // agreement to sell
  balanceDue: text(80),
  balanceDueDate: date,
  forfeitOnBuyerDefault: z.boolean().default(true),
  sellerDefaultRemedy: z.enum(["either", "double", "specific"]).default("either"),
  existingLoanBank: text(200),
  buyerLoanBank: text(200),
  // tenancy (rent & lease)
  purpose: text(300),
  startDate: date,
  termMonths: optionalNumber,
  monthlyRent: optionalNumber,
  rentDueDay: optionalNumber,
  rentAccount: text(300),
  securityDeposit: optionalNumber,
  escalationPercent: optionalNumber,
  escalationEveryYears: optionalNumber,
  lockInMonths: optionalNumber,
  noticeMonths: optionalNumber,
  rentFreeDays: optionalNumber,
  utilitiesBy: z.enum(["tenant", "owner"]).default("tenant"),
  maintenanceBy: z.enum(["tenant", "owner"]).default("tenant"),
  propertyTaxBy: z.enum(["tenant", "owner"]).default("owner"),
  jurisdiction: text(80),
  arbitration: z.boolean().default(false),
  // every deed
  additionalClauses: text(6000),
});

/* --------------------------------------------------------------- Execution */

export const executionSchema = z.object({
  place: text(80),
  date,
  subRegistrarOffice: text(120),
  expensesBy: z.enum(["second", "first", "shared"]).default("second"),
  invocation: z.boolean().default(false),
  maskAadhaar: z.boolean().default(false),
  mapAttached: z.boolean().default(true),
});

/* --------------------------------------------------------------- Aggregate */

/** Parses an array item by item so one malformed record never discards the rest. */
function lenientArray<T extends z.ZodTypeAny>(schema: T, max: number) {
  return z
    .array(z.unknown())
    .catch([])
    .transform((items) =>
      items.slice(0, max).flatMap((item) => {
        const parsed = schema.safeParse(item);
        return parsed.success ? [parsed.data as z.output<T>] : [];
      }),
    );
}

const emptyTerms = termsSchema.parse({});
const emptyExecution = executionSchema.parse({});

export const deedDataSchema = z.object({
  version: z.number().int().optional(),
  parties: lenientArray(partySchema, 50),
  properties: lenientArray(propertySchema, 25),
  titleChain: lenientArray(titleEntrySchema, 25),
  consideration: considerationSchema.catch({}),
  payments: lenientArray(paymentSchema, 60),
  terms: termsSchema.catch(emptyTerms),
  execution: executionSchema.catch(emptyExecution),
});

export const sectionSchemas = {
  parties: z.array(partySchema).max(50),
  properties: z.array(propertySchema).max(25),
  titleChain: z.array(titleEntrySchema).max(25),
  payments: z.array(paymentSchema).max(60),
  consideration: considerationSchema,
  terms: termsSchema,
  execution: executionSchema,
} as const;

export type SectionKey = keyof typeof sectionSchemas;

export const updateDeedSectionSchema = z.discriminatedUnion("section", [
  z.object({ id: z.string().uuid(), section: z.literal("parties"), value: sectionSchemas.parties }),
  z.object({ id: z.string().uuid(), section: z.literal("properties"), value: sectionSchemas.properties }),
  z.object({ id: z.string().uuid(), section: z.literal("titleChain"), value: sectionSchemas.titleChain }),
  z.object({ id: z.string().uuid(), section: z.literal("payments"), value: sectionSchemas.payments }),
  z.object({ id: z.string().uuid(), section: z.literal("consideration"), value: sectionSchemas.consideration }),
  z.object({ id: z.string().uuid(), section: z.literal("terms"), value: sectionSchemas.terms }),
  z.object({ id: z.string().uuid(), section: z.literal("execution"), value: sectionSchemas.execution }),
]);

export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name.").max(120),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
});

export type Party = z.infer<typeof partySchema>;
export type Property = z.infer<typeof propertySchema>;
export type TitleEntry = z.infer<typeof titleEntrySchema>;
export type Payment = z.infer<typeof paymentSchema>;
export type Consideration = z.infer<typeof considerationSchema>;
export type Terms = z.infer<typeof termsSchema>;
export type Execution = z.infer<typeof executionSchema>;
export type DeedData = z.infer<typeof deedDataSchema>;
export type PartyRole = z.infer<typeof partyRoleSchema>;

export function emptyDeedData(): DeedData {
  return { version: DEED_DATA_VERSION, parties: [], properties: [], titleChain: [], consideration: {}, payments: [], terms: emptyTerms, execution: emptyExecution };
}

export function parseDeedData(value: unknown): DeedData {
  const parsed = deedDataSchema.safeParse(value ?? {});
  return parsed.success ? { ...parsed.data, version: DEED_DATA_VERSION } : emptyDeedData();
}
