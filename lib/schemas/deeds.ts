import { z } from "zod";

const deedType = z.enum(["sale", "release", "gift", "partition", "will", "other"]);
const deedLanguage = z.enum(["english", "hindi", "bilingual"]);
const deedStatus = z.enum([
  "draft",
  "data_collection",
  "under_review",
  "generated",
  "finalized",
]);

export const createDeedSchema = z.object({
  deedType,
  title: z.string().trim().min(3, "Enter a descriptive deed title.").max(180),
  language: deedLanguage,
  remarks: z.string().trim().max(4000).optional().or(z.literal("")),
});

export const updateDeedTitleSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(3).max(180),
});

export const updateDeedStatusSchema = z.object({
  id: z.string().uuid(),
  status: deedStatus,
});

export const updateRemarksSchema = z.object({
  id: z.string().uuid(),
  remarks: z.string().trim().max(4000),
});

export const deedIdSchema = z.object({ id: z.string().uuid() });
export const deleteDeedSchema = deedIdSchema.extend({
  referenceNo: z.string().trim().min(1),
});

export type CreateDeedInput = z.infer<typeof createDeedSchema>;
