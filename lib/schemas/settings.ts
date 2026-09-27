import { z } from "zod";

import { citySchema, firmNameSchema } from ".";

export const updateFirmSchema = z.object({
  name: firmNameSchema,
  city: citySchema,
  barRegistrationNo: z.string().trim().max(100).optional().or(z.literal("")),
});
