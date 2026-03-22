import { z } from "zod";

export const storeReportSchema = z.object({
  slug: z.string().min(1, "storeUnavailable"),
  locale: z.string().min(2),
  reason: z.enum(["SPAM", "DUPLICATE", "INCORRECT_INFO", "DOES_NOT_EXIST", "INAPPROPRIATE"], {
    errorMap: () => ({ message: "reasonRequired" }),
  }),
  details: z.string().max(500, "detailsTooLong").trim().optional().nullable(),
});

export type StoreReportInput = z.infer<typeof storeReportSchema>;
