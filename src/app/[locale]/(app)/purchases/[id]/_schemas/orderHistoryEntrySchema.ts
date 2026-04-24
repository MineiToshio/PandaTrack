import { z } from "zod";

export const orderHistoryEntrySchema = z.object({
  entryId: z.string().cuid({ message: "INVALID_ENTRY_ID" }),
  orderId: z.string().cuid({ message: "INVALID_ORDER_ID" }),
});

export type OrderHistoryEntryInput = z.infer<typeof orderHistoryEntrySchema>;
