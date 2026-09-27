import { z } from "zod";

const text = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

const optionalNumber = z.preprocess(
  (value) =>
    value === "" || value === null || value === undefined || (typeof value === "number" && Number.isNaN(value))
      ? undefined
      : Number(value),
  z.number({ invalid_type_error: "Enter a number." }).nonnegative("Must be zero or more.").optional(),
);

export const partyRoleSchema = z.enum(["first", "second", "witness", "other"]);
export const relationSchema = z.enum(["S/o", "D/o", "W/o", "C/o"]);

export const partySchema = z.object({
  id: z.string().min(1).max(64),
  role: partyRoleSchema,
  fullName: z.string().trim().min(2, "Enter the full name.").max(160),
  relation: relationSchema,
  relativeName: text(160),
  age: optionalNumber,
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
});

export const propertyKindSchema = z.enum(["plot", "house", "flat", "shop", "agricultural", "other"]);
export const areaUnitSchema = z.enum(["sq_ft", "sq_yd", "sq_m", "bigha", "hectare", "acre"]);

export const propertySchema = z.object({
  id: z.string().min(1).max(64),
  kind: propertyKindSchema,
  description: z.string().trim().min(3, "Describe the property.").max(500),
  identifier: text(120),
  area: optionalNumber,
  areaUnit: areaUnitSchema,
  locality: text(160),
  tehsil: text(80),
  district: text(80),
  state: text(80),
  north: text(200),
  south: text(200),
  east: text(200),
  west: text(200),
  marketValue: optionalNumber,
});

export const paymentModeSchema = z.enum(["cash", "cheque", "rtgs_neft", "upi", "dd", "other"]);

export const paymentSchema = z.object({
  id: z.string().min(1).max(64),
  mode: paymentModeSchema,
  amount: z.preprocess(
    (value) => (value === "" || value === undefined ? undefined : Number(value)),
    z.number({ required_error: "Enter an amount.", invalid_type_error: "Enter an amount." }).positive("Amount must be more than zero."),
  ),
  date: text(10),
  reference: text(80),
  bank: text(120),
  notes: text(300),
});

export const considerationSchema = z.object({
  total: optionalNumber,
  stampDuty: optionalNumber,
  registrationFee: optionalNumber,
});

export const deedDataSchema = z.object({
  parties: z.array(partySchema).max(50).catch([]),
  properties: z.array(propertySchema).max(25).catch([]),
  consideration: considerationSchema.catch({}),
  payments: z.array(paymentSchema).max(50).catch([]),
});

export const updateDeedSectionSchema = z.discriminatedUnion("section", [
  z.object({ id: z.string().uuid(), section: z.literal("parties"), value: z.array(partySchema).max(50) }),
  z.object({ id: z.string().uuid(), section: z.literal("properties"), value: z.array(propertySchema).max(25) }),
  z.object({ id: z.string().uuid(), section: z.literal("payments"), value: z.array(paymentSchema).max(50) }),
  z.object({ id: z.string().uuid(), section: z.literal("consideration"), value: considerationSchema }),
]);

export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name.").max(120),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
});

export type Party = z.infer<typeof partySchema>;
export type Property = z.infer<typeof propertySchema>;
export type Payment = z.infer<typeof paymentSchema>;
export type Consideration = z.infer<typeof considerationSchema>;
export type DeedData = z.infer<typeof deedDataSchema>;
export type PartyRole = z.infer<typeof partyRoleSchema>;

export function parseDeedData(value: unknown): DeedData {
  const parsed = deedDataSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : { parties: [], properties: [], consideration: {}, payments: [] };
}
