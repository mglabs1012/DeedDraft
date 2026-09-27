import { z } from "zod";

export const firmNameSchema = z
  .string()
  .trim()
  .min(2, "Enter a firm name.")
  .max(120, "Firm name must be 120 characters or fewer.");

export const citySchema = z
  .string()
  .trim()
  .min(2, "Enter a city.")
  .max(80, "City must be 80 characters or fewer.");

export const onboardingSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Enter your full name.")
    .max(120, "Name must be 120 characters or fewer."),
  phone: z
    .string()
    .trim()
    .max(30, "Phone number must be 30 characters or fewer.")
    .optional()
    .or(z.literal("")),
  firmName: firmNameSchema,
  city: citySchema,
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
