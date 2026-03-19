import { z } from "zod";

export const storeNoteSchema = z.object({
  slug: z.string().trim().min(1, "storeUnavailable"),
  locale: z.string().trim().min(2),
  content: z.string().trim().min(1, "noteRequired").max(2000, "noteTooLong"),
});

export type StoreNoteInput = z.infer<typeof storeNoteSchema>;
