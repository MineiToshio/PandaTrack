import { z } from "zod";

export const storeProductTypeRequestSchema = z.object({
  locale: z.string().min(2),
  source: z.enum(["create", "edit"]),
  suggestedName: z.string().min(1, "suggestedNameRequired").max(50, "suggestedNameTooLong").trim(),
  reason: z.string().max(500, "reasonTooLong").trim().optional().nullable(),
});

export type StoreProductTypeRequestInput = z.infer<typeof storeProductTypeRequestSchema>;
