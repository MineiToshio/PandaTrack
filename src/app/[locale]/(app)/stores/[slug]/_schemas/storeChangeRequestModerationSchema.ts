import { z } from "zod";

/** Boundary for the apply / reject change-request actions: which request, which store, the locale. */
export const storeChangeRequestModerationSchema = z.object({
  slug: z.string().min(1, "slugRequired"),
  locale: z.string().min(1, "localeRequired"),
  changeRequestId: z.string().min(1, "changeRequestRequired"),
});

export type StoreChangeRequestModerationInput = z.infer<typeof storeChangeRequestModerationSchema>;
