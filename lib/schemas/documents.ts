import { z } from "zod";

export const documentCategorySchema = z.enum([
  "naksha_map",
  "id_proof",
  "prior_title_deed",
  "jamabandi",
  "payment_proof",
  "photograph",
  "patta",
  "loan_papers",
  "stamp_paper",
  "other",
]);

export const createDocumentSchema = z.object({
  deedId: z.string().uuid(),
  category: documentCategorySchema,
  fileName: z.string().trim().min(1).max(255),
  storagePath: z.string().trim().min(1).max(1024),
  mimeType: z.enum(["application/pdf", "image/jpeg", "image/png"]),
  sizeBytes: z.number().int().positive().max(20 * 1024 * 1024),
});

export const recategorizeDocumentSchema = z.object({
  id: z.string().uuid(),
  category: documentCategorySchema,
});

export const documentIdSchema = z.object({ id: z.string().uuid() });
