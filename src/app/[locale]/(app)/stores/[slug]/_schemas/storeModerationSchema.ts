import { z } from "zod";
import { STORE_REMOVAL_REASONS } from "@/lib/store/removalReason";

const MODERATION_NOTE_MAX_LENGTH = 500;

/** Optional, non-sensitive internal note attached to the audit entry. Blank normalizes to null. */
const moderationNote = z
  .string()
  .trim()
  .max(MODERATION_NOTE_MAX_LENGTH, "noteTooLong")
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null));

/** Shared boundary for the approve / flag / unflag actions: which store, and the current locale. */
export const storeModerationSchema = z.object({
  slug: z.string().min(1, "slugRequired"),
  locale: z.string().min(1, "localeRequired"),
  note: moderationNote,
});

/** Removal additionally requires one of the four typed removal reasons. */
export const storeRemovalSchema = storeModerationSchema.extend({
  removalReason: z.enum(STORE_REMOVAL_REASONS, { message: "removalReasonRequired" }),
});

export type StoreModerationInput = z.infer<typeof storeModerationSchema>;
export type StoreRemovalInput = z.infer<typeof storeRemovalSchema>;
