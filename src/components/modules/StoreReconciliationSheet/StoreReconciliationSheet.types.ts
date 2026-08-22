import type { StoreReconciliationOrderRow } from "@/lib/data/orders/storeAccountAdjustmentQueries";
import type { ReconciliationLineInput } from "@/lib/orders/storeReconciliationSheetState";

export type { StoreReconciliationOrderRow };

/** What the sheet submits: a reason plus one line per order the collector marked. */
export type StoreReconciliationSubmitInput = {
  reason: string;
  lines: ReconciliationLineInput[];
};

/**
 * What the coordinator tells the sheet about a submission, mirroring `StorePaymentSubmitOutcome`'s
 * own shape (`StorePaymentSheet.types.ts`): a resolved outcome either way, with `unanswered` marking
 * a dropped connection rather than a refusal the server described.
 */
export type StoreReconciliationSubmitOutcome =
  | { ok: true }
  | {
      ok: false;
      error: string;
      /** The order a line-scoped refusal names (`ORDER_CANCELLED`, `ADJUSTMENT_EXCEEDS_ORDER_BALANCE`). */
      orderId?: string;
      unanswered?: true;
    };
