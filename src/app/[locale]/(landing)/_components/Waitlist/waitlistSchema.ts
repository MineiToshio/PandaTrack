import { z } from "zod";

export const waitlistSchema = z.object({
  email: z.string().min(1, "emailRequired").email("emailInvalid"),
  name: z.string().optional(),
  comment: z.string().optional(),
});

export type WaitlistInput = z.infer<typeof waitlistSchema>;
