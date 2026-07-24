import { z } from "zod";

/** Boundary for the resolve / dismiss report actions: which report, which store, and the locale. */
export const storeReportModerationSchema = z.object({
  slug: z.string().min(1, "slugRequired"),
  locale: z.string().min(1, "localeRequired"),
  reportId: z.string().min(1, "reportRequired"),
});

export type StoreReportModerationInput = z.infer<typeof storeReportModerationSchema>;
