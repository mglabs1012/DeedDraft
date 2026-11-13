import { z } from "zod";

import { deedTypeIds } from "@/lib/deed-types";

const deedType = z.enum(deedTypeIds);
const deedLanguage = z.enum(["english", "hindi", "bilingual"]);
export const createDeedSchema = z.object({
  deedType,
  title: z.string().trim().min(3, "Enter a descriptive deed title.").max(180),
  language: deedLanguage,
  remarks: z.string().trim().max(4000).optional().or(z.literal("")),
  /** Library template id when the deed starts from the template library. */
  templateId: z.string().trim().max(120).optional(),
  mode: z.enum(["standard", "premium"]).default("standard"),
});

export const updateDeedTitleSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(3).max(180),
});

export const updateRemarksSchema = z.object({
  id: z.string().uuid(),
  remarks: z.string().trim().max(4000),
});

export const deedIdSchema = z.object({ id: z.string().uuid() });
export const deleteDeedSchema = deedIdSchema.extend({
  referenceNo: z.string().trim().min(1),
});

