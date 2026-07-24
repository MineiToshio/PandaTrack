import { z } from "zod";

/** Max length of a product-type request name, mirroring the requester-side limit (BR-04-18). */
export const PRODUCT_TYPE_NAME_MAX_LENGTH = 50;
/** Max length of an explicit catalog key override. */
export const PRODUCT_TYPE_KEY_MAX_LENGTH = 64;

const localizedNameSchema = z.string().trim().min(1).max(PRODUCT_TYPE_NAME_MAX_LENGTH);

/**
 * Boundary schema for approving a product-type request. The reviewing admin confirms the localized
 * `es` / `en` names the catalog row will carry and may override the generated `key`; `locale` scopes
 * the revalidation to the caller's URL tree.
 */
export const approveProductTypeRequestSchema = z.object({
  requestId: z.string().min(1),
  locale: z.string().min(2).max(5),
  nameEs: localizedNameSchema,
  nameEn: localizedNameSchema,
  key: z
    .string()
    .trim()
    .max(PRODUCT_TYPE_KEY_MAX_LENGTH)
    .regex(/^[a-z0-9_]+$/)
    .optional(),
});

/** Boundary schema for rejecting a product-type request. */
export const rejectProductTypeRequestSchema = z.object({
  requestId: z.string().min(1),
  locale: z.string().min(2).max(5),
});

export type ApproveProductTypeRequestInput = z.infer<typeof approveProductTypeRequestSchema>;
export type RejectProductTypeRequestInput = z.infer<typeof rejectProductTypeRequestSchema>;
