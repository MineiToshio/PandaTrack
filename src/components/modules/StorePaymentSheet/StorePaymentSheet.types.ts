import type { BuiltAllocationInput } from "@/lib/orders/storePaymentSheetValidation";

/** One currency the collector has standing orders or payments with this store in. */
export type StorePaymentSheetDebt = { currencyCode: string; debtMinor: number };

export type StorePaymentSheetSubmitInput = {
  amount: number;
  paymentDate: Date;
  currencyCode: string;
  note: string | null;
  allocations: BuiltAllocationInput[];
  /**
   * Products this payment declares covered, with no amount attached. A second axis, not a split of
   * `amount`: it enters no ceiling here and moves no figure on the server.
   */
  declarePaidItemIds: string[];
};

/**
 * What the coordinator tells the sheet about a submission.
 *
 * One signature covers both paths so the sheet needs no special case: on the "on account" path
 * (no declarations) the coordinator resolves `{ ok: true }` immediately and keeps the mutation in
 * flight behind it, so the sheet still closes synchronously; on the declared path it resolves with
 * the server's real answer, and a refusal carries the line the server named so the draft can be
 * kept and the culprit marked.
 */
export type StorePaymentSubmitOutcome =
  | { ok: true }
  | {
      ok: false;
      error: string;
      orderId?: string;
      orderItemId?: string;
      /**
       * No answer at all rather than a verdict the server described: a dropped connection, a 502
       * from the server-actions endpoint, a deploy mid-flight.
       *
       * Both coordinators ABSORB a rejected promise (their `onRejected` returns a resolved outcome,
       * because a `catch` chained after the success handler would roll a committed payment back off
       * the screen), so from the sheet's side a network drop and a refusal are the same resolved
       * `{ ok: false }`. This flag is the only thing that tells them apart, and the difference is
       * the opposite treatment they need: nothing was refused, so resending the very same payment
       * is exactly the right move and the CTA must stay live for it.
       */
      unanswered?: true;
    };
