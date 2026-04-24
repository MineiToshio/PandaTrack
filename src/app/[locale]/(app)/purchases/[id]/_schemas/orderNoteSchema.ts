import { z } from "zod";

export const orderNoteSchema = z.object({
  orderId: z.string().cuid({ message: "INVALID_ORDER_ID" }),
  note: z.string().max(2000).nullable().optional(),
});

export type OrderNoteInput = z.infer<typeof orderNoteSchema>;
