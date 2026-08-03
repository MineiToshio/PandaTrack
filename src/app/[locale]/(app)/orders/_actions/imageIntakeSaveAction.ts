"use server";

import { createHash } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import { getSession } from "@/lib/auth/auth-server";
import { getPostHogClient } from "@/lib/analytics/posthog-server";
import { POSTHOG_EVENTS } from "@/lib/constants";
import { findOrderIdByNoteMarker } from "@/lib/data/orders/orderQueries";
import { createOrder } from "@/lib/data/orders/orderMutations";
import { addOrderPayment } from "@/lib/data/orders/orderPaymentMutations";
import { parseImageIntakeDraft, type ImageIntakeDraft } from "@/lib/imageIntake/draftSchema";
import {
  mapDraftToOrderCreateInput,
  mapDraftToOrderPaymentCreateInputs,
} from "@/lib/imageIntake/mapDraftToOrderCreate";
import { exchangeRateSchema, orderCreateSchema, orderPaymentCreateSchema } from "@/lib/orders/orderValidation";
import type { ImageIntakeSaveResult } from "./imageIntakeContract";

/** Marker namespace, matching the `[import:<source>:<digest>]` shape already used by the chat importer. */
const IMAGE_INTAKE_MARKER_NAMESPACE = "image-intake";
const MARKER_DIGEST_LENGTH = 16;

/**
 * Stable signature of one confirmed draft. Built from the fields that identify the purchase rather
 * than from the whole object, so a resubmission of the same reviewed draft (a double-tap, a
 * retried request) resolves to the same marker while two genuinely different orders never collide.
 */
function buildIdempotencyMarker(userId: string, draft: ImageIntakeDraft): string {
  const itemSignature = draft.groups
    .flatMap((group) => group.products.map((product) => `${product.name}:${product.unitPrice ?? ""}`))
    .join("|");
  const digest = createHash("sha256")
    .update(
      [
        userId,
        draft.store.matchedStoreId ?? "",
        draft.orderDate.value ?? "",
        draft.currency.value ?? "",
        String(draft.totalCost.value ?? ""),
        itemSignature,
      ].join("|"),
    )
    .digest("hex")
    .slice(0, MARKER_DIGEST_LENGTH);
  return `[${IMAGE_INTAKE_MARKER_NAMESPACE}:${digest}]`;
}

/**
 * Reads the exchange rate the review screen sent alongside the draft. It arrives over the same
 * untrusted hop as everything else, so it is validated against the order domain's own rate schema
 * rather than trusted as a number. Absent and `null` both mean "no rate", which is a legal order:
 * it is simply one that will not count toward base-currency totals until it is reconciled.
 */
function resolveExchangeRate(raw: unknown): { ok: true; value: number | null } | { ok: false } {
  if (raw === undefined || raw === null) return { ok: true, value: null };
  const parsed = exchangeRateSchema.safeParse(raw);
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false };
}

/**
 * Persists a draft the user reviewed and confirmed on the review screen.
 *
 * The draft arrives from the client, so it is re-parsed against the same strict contract the
 * extraction engine's output had to pass: the round trip through the browser is an untrusted hop,
 * and `orderCreateSchema` is then the single authority on whether the confirmed values are a
 * legal order.
 *
 * This module never touches the extraction engine or the model provider. Producing a draft and
 * writing an order are kept in separate files on purpose, so no code path can reach persistence
 * without the human confirmation this action's name implies.
 *
 * It writes an order and its payments, and no delivery. A delivery is a shipment that was actually
 * dispatched: it is dated in the past, it holds real products, and creating one puts those products
 * in transit. What a chat provides is the opposite, a promised arrival window and a shipping cost,
 * so the window rides on the order's own expected-delivery fields and the cost is surfaced on the
 * review screen instead of being invented into a shipment that nobody has sent.
 */
export async function saveOrderFromDraftAction(
  rawDraft: unknown,
  rawExchangeRate?: unknown,
): Promise<ImageIntakeSaveResult> {
  const session = await getSession();
  if (!session?.user?.id) {
    return { ok: false, code: "unauthorized" };
  }
  const userId = session.user.id;

  const parsedDraft = parseImageIntakeDraft(rawDraft);
  if (!parsedDraft.ok) {
    return { ok: false, code: "invalid-draft" };
  }
  const draft = parsedDraft.draft;

  // The rate rides beside the draft rather than inside it: it is the collector's answer on the
  // review screen, not something the extraction read from the source, and the draft contract is
  // the record of what was read. Absent stays absent, and the order waits for reconciliation.
  const parsedExchangeRate = resolveExchangeRate(rawExchangeRate);
  if (!parsedExchangeRate.ok) {
    return { ok: false, code: "invalid-draft" };
  }

  const createInput = mapDraftToOrderCreateInput(draft);
  if (!createInput.storeId) {
    return { ok: false, code: "store-required" };
  }
  if (createInput.totalCost === null) {
    return { ok: false, code: "total-required" };
  }

  const marker = buildIdempotencyMarker(userId, draft);

  const parsedOrder = orderCreateSchema.safeParse({
    storeId: createInput.storeId,
    orderDate: createInput.orderDate ?? undefined,
    expectedDeliveryFrom: createInput.expectedDeliveryFrom,
    expectedDeliveryTo: createInput.expectedDeliveryTo,
    currencyCode: createInput.currencyCode ?? undefined,
    exchangeRate: parsedExchangeRate.value,
    totalCost: createInput.totalCost,
    note: marker,
    items: createInput.items,
  });

  if (!parsedOrder.success) {
    return { ok: false, code: "invalid-draft" };
  }

  try {
    const existingOrderId = await findOrderIdByNoteMarker(userId, marker);
    if (existingOrderId) {
      // The same reviewed draft was already saved. Returning the existing order is the honest
      // outcome: the user asked for one order and there is exactly one.
      return { ok: true, orderId: existingOrderId, paymentsRecorded: 0, paymentsSkipped: 0 };
    }

    const created = await createOrder(userId, parsedOrder.data);
    if (!created.ok) {
      return { ok: false, code: created.error === "STORE_NOT_FOUND" ? "store-not-found" : "invalid-product-type" };
    }

    const { recorded, skipped } = await recordDraftPayments(draft, created.orderId, userId);

    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: userId,
      event: POSTHOG_EVENTS.IMAGE_INTAKE.ORDER_SAVED_FROM_IMAGE,
      properties: {
        product_count: createInput.items.length,
        group_count: draft.groups.length,
        payments_recorded: recorded,
        payments_skipped: skipped,
        warning_count: draft.warnings.length,
      },
    });
    await posthog.shutdown();

    return { ok: true, orderId: created.orderId, paymentsRecorded: recorded, paymentsSkipped: skipped };
  } catch (error) {
    Sentry.captureException(error, { tags: { feature: "imageIntake", action: "saveOrderFromDraft" } });
    return { ok: false, code: "server-error" };
  }
}

/**
 * Writes the draft's payments against the order that was just created. A payment the order domain
 * refuses (a date before the order, an amount over the balance) is counted and skipped rather than
 * failing the save: the order itself is already correct and exists, and losing it over a secondary
 * row the user can add in two taps would be the worse outcome.
 */
async function recordDraftPayments(
  draft: ImageIntakeDraft,
  orderId: string,
  userId: string,
): Promise<{ recorded: number; skipped: number }> {
  const paymentInputs = mapDraftToOrderPaymentCreateInputs(draft, orderId);
  let recorded = 0;
  let skipped = 0;

  for (const paymentInput of paymentInputs) {
    const parsed = orderPaymentCreateSchema.safeParse({
      orderId: paymentInput.orderId,
      amount: paymentInput.amount ?? undefined,
      paymentDate: paymentInput.paymentDate ?? undefined,
    });
    if (!parsed.success) {
      skipped += 1;
      continue;
    }

    const result = await addOrderPayment({
      orderId: parsed.data.orderId,
      userId,
      amount: parsed.data.amount,
      paymentDate: parsed.data.paymentDate,
    });
    if (result.ok) {
      recorded += 1;
    } else {
      skipped += 1;
    }
  }

  return { recorded, skipped };
}
