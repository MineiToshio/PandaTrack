import { z } from "zod";

const isHalfStepRating = (value: number) => Number.isInteger(value * 2);

export const storeReviewSchema = z.object({
  slug: z.string().trim().min(1, "storeUnavailable"),
  locale: z.string().trim().min(2),
  overallRating: z.coerce
    .number()
    .min(0.5, "overallRatingInvalid")
    .max(5, "overallRatingInvalid")
    .refine(isHalfStepRating, "overallRatingInvalid"),
  comment: z
    .string()
    .trim()
    .max(1000, "commentTooLong")
    .optional()
    .transform((value) => value || undefined),
});

export type StoreReviewInput = z.infer<typeof storeReviewSchema>;
