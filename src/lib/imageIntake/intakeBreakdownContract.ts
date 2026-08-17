import { z } from "zod";
import { MAX_PAYMENTS_PER_ORDER, MAX_PRODUCTS_PER_ORDER } from "./constants";

/**
 * The wire shape of "which product each payment of this draft covers", declared on the review
 * screen against an order that does not exist yet.
 *
 * It rides BESIDE the draft, never inside it. The draft is the model's answer, re-parsed
 * server-side, and putting a split in there would hand a machine the one declaration ADR 0028
 * reserves for the collector. This contract is the collector's own, and it is a separate argument
 * of the save action for exactly that reason.
 *
 * The key is the product's POSITION in the flattened draft, not an id: the order items have no ids
 * until the create transaction commits, and position is the only key that means the same thing on
 * both sides of the client/server hop (`flattenGroupsToItems` emits it, `order_item.position`
 * persists it). The save action resolves position to `orderItemId` after the commit.
 */
export const intakeBreakdownLineSchema = z.object({
  /** Ordinal of the product in the flattened draft, 1-based. The same one `orderItemRowSchema` carries. */
  position: z.number().int().min(1).max(MAX_PRODUCTS_PER_ORDER),
  /**
   * Never a zero. A zero-amount declaration covers nothing and `validateAllocations` refuses it,
   * which would take the whole payment row down with it: this bound is the door that keeps a client
   * bug from ever getting that far.
   */
  amountMinor: z.number().int().min(1),
});

export const intakeBreakdownEntrySchema = z.object({
  /** Index of the row in `draft.payments`. Only rows that carry a breakdown appear at all. */
  paymentIndex: z
    .number()
    .int()
    .min(0)
    .max(MAX_PAYMENTS_PER_ORDER - 1),
  lines: z.array(intakeBreakdownLineSchema).min(1).max(MAX_PRODUCTS_PER_ORDER),
});

/**
 * The whole payload: one entry per payment row that carries a breakdown, and nothing for the rest.
 *
 * The bounds are image intake's own (`MAX_PRODUCTS_PER_ORDER`, `MAX_PAYMENTS_PER_ORDER`) rather
 * than the order domain's: `MAX_ORDER_ITEMS` and `MAX_PAYMENT_ALLOCATIONS` are module constants
 * there, not exports, and these two are the ones that already govern this draft. They agree today,
 * and the authoritative ceiling stays the server's own (`orderPaymentCreateSchema` refuses a
 * payload over 200 allocations whatever this file says).
 */
export const intakeBreakdownSchema = z
  .array(intakeBreakdownEntrySchema)
  .max(MAX_PAYMENTS_PER_ORDER)
  .superRefine((entries, ctx) => {
    const seenPaymentIndexes = new Set<number>();
    entries.forEach((entry, index) => {
      if (seenPaymentIndexes.has(entry.paymentIndex)) {
        // Two entries for one payment row would make "the lines of row k" ambiguous, and the
        // reader picks the first: the collector's other declaration would vanish in silence.
        ctx.addIssue({ code: "custom", path: [index, "paymentIndex"], message: "DUPLICATE_PAYMENT_INDEX" });
      }
      seenPaymentIndexes.add(entry.paymentIndex);

      const seenPositions = new Set<number>();
      entry.lines.forEach((line, lineIndex) => {
        if (seenPositions.has(line.position)) {
          // One product, two amounts. The server would write both against the same item and the
          // sum the collector saw in the panel would not be the sum that landed.
          ctx.addIssue({
            code: "custom",
            path: [index, "lines", lineIndex, "position"],
            message: "DUPLICATE_POSITION",
          });
        }
        seenPositions.add(line.position);
      });
    });
  });

export type IntakeBreakdownLine = z.infer<typeof intakeBreakdownLineSchema>;
export type IntakeBreakdownEntry = z.infer<typeof intakeBreakdownEntrySchema>;
export type IntakeBreakdownPayload = z.infer<typeof intakeBreakdownSchema>;
