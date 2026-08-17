"use server";

import { createHash } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import { getSession } from "@/lib/auth/auth-server";
import { getPostHogClient } from "@/lib/analytics/posthog-server";
import { POSTHOG_EVENTS } from "@/lib/constants";
import { findOrderIdByNoteMarker, listOrderItemPositions } from "@/lib/data/orders/orderQueries";
import { createOrder } from "@/lib/data/orders/orderMutations";
import { addOrderPayment } from "@/lib/data/orders/orderPaymentMutations";
import { parseImageIntakeDraft, type ImageIntakeDraft } from "@/lib/imageIntake/draftSchema";
import { intakeBreakdownSchema, type IntakeBreakdownPayload } from "@/lib/imageIntake/intakeBreakdownContract";
import {
  mapDraftToOrderCreateInput,
  mapDraftToOrderPaymentCreateInputs,
} from "@/lib/imageIntake/mapDraftToOrderCreate";
import { exchangeRateSchema, orderCreateSchema, orderPaymentCreateSchema } from "@/lib/orders/orderValidation";
import { IMAGE_INTAKE_SAVE_TOKEN_PATTERN, type ImageIntakeSaveResult } from "./imageIntakeContract";

/** Marker namespace, matching the `[import:<source>:<digest>]` shape already used by the chat importer. */
const IMAGE_INTAKE_MARKER_NAMESPACE = "image-intake";
const MARKER_DIGEST_LENGTH = 16;

/**
 * Stable signature of one confirmed save, preferring the review screen's own token.
 *
 * The token is minted once per extracted draft and does not move when the draft is corrected, which
 * is what makes a retry a retry. The content-derived signature below is the fallback for a caller
 * that sends no token: it identifies the purchase rather than the whole object, so a double-tap on
 * an unchanged draft still resolves to one order, but a retry after an edit does not, which is
 * precisely the gap the token closes.
 *
 * The token is hashed, never stored: what lands in the order's note is a digest, like every other
 * marker this namespace writes.
 */
function buildIdempotencyMarker(userId: string, draft: ImageIntakeDraft, saveToken: string | null): string {
  if (saveToken !== null) {
    const tokenDigest = createHash("sha256")
      .update([userId, saveToken].join("|"))
      .digest("hex")
      .slice(0, MARKER_DIGEST_LENGTH);
    return `[${IMAGE_INTAKE_MARKER_NAMESPACE}:${tokenDigest}]`;
  }

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
 * Reads the per-payment breakdown the review screen sent. Absent and `null` both mean "nothing was
 * declared", which is the ordinary path: most payments name no product at all.
 */
function resolveBreakdown(raw: unknown): { ok: true; value: IntakeBreakdownPayload } | { ok: false } {
  if (raw === undefined || raw === null) return { ok: true, value: [] };
  const parsed = intakeBreakdownSchema.safeParse(raw);
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
  rawSaveToken?: unknown,
  rawBreakdown?: unknown,
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

  // The breakdown rides beside the draft for the same reason the rate does, and for one more: it is
  // the collector's own declaration about their money, so it must never travel inside the contract
  // the model answers on. A payload that is present and does not parse REFUSES the whole save
  // instead of degrading to "no breakdown": silently writing the payment without the lines the
  // collector typed is the loss this feature exists to stop, and nothing has been written yet.
  const parsedBreakdown = resolveBreakdown(rawBreakdown);
  if (!parsedBreakdown.ok) {
    return { ok: false, code: "invalid-draft" };
  }
  const breakdowns = parsedBreakdown.value;

  const createInput = mapDraftToOrderCreateInput(draft);
  if (!createInput.storeId) {
    return { ok: false, code: "store-required" };
  }
  if (createInput.totalCost === null) {
    return { ok: false, code: "total-required" };
  }

  // Untrusted like everything else that crosses this hop, and checked for shape rather than
  // trusted: it is only ever hashed with the caller's own id, so a token belonging to someone else
  // resolves to a marker no order of theirs carries.
  const saveToken =
    typeof rawSaveToken === "string" && IMAGE_INTAKE_SAVE_TOKEN_PATTERN.test(rawSaveToken) ? rawSaveToken : null;
  const marker = buildIdempotencyMarker(userId, draft, saveToken);

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
      //
      // What is NOT honest is reporting zero skipped breakdowns. This branch is also what a retry
      // lands on after a first attempt died between writing the order and writing its payments, and
      // in that case an unknown suffix of the payment rows never made it. Which ones cannot be
      // recovered: `recordDraftPayments` steps over a refused row instead of stopping, so counting
      // what is already there and calling the rest lost is wrong in both directions. So every row
      // that carried a breakdown is named, on purpose over-reporting, and the collector checks the
      // order's own detail, where the panel has lived since ADR 0028.
      return {
        ok: true,
        orderId: existingOrderId,
        paymentsRecorded: 0,
        paymentsSkipped: 0,
        skippedBreakdownIndexes: breakdowns.map((entry) => entry.paymentIndex),
        breakdownDropped: 0,
      };
    }

    const created = await createOrder(userId, parsedOrder.data);
    if (!created.ok) {
      return { ok: false, code: created.error === "STORE_NOT_FOUND" ? "store-not-found" : "invalid-product-type" };
    }

    const { recorded, skipped, skippedBreakdownIndexes, breakdownDropped } = await recordDraftPayments(
      draft,
      created.orderId,
      userId,
      breakdowns,
    );

    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: userId,
      event: POSTHOG_EVENTS.IMAGE_INTAKE.ORDER_SAVED_FROM_IMAGE,
      properties: {
        product_count: createInput.items.length,
        group_count: draft.groups.length,
        payments_recorded: recorded,
        payments_skipped: skipped,
        breakdown_payments: breakdowns.length,
        breakdown_lines: breakdowns.reduce((sum, entry) => sum + entry.lines.length, 0),
        warning_count: draft.warnings.length,
      },
    });
    await posthog.shutdown();

    return {
      ok: true,
      orderId: created.orderId,
      paymentsRecorded: recorded,
      paymentsSkipped: skipped,
      skippedBreakdownIndexes,
      breakdownDropped,
    };
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
 *
 * A row that carried a breakdown is the exception to "two taps", because what is lost there is up to
 * N hand-typed lines. It is still skipped rather than fatal, but its index comes back named so the
 * screen can say so instead of navigating away in silence.
 */
async function recordDraftPayments(
  draft: ImageIntakeDraft,
  orderId: string,
  userId: string,
  breakdowns: IntakeBreakdownPayload,
): Promise<{ recorded: number; skipped: number; skippedBreakdownIndexes: number[]; breakdownDropped: number }> {
  const paymentInputs = mapDraftToOrderPaymentCreateInputs(draft, orderId);
  const linesByPaymentIndex = new Map(breakdowns.map((entry) => [entry.paymentIndex, entry.lines]));

  // One indexed read, outside every transaction, and only when there is something to resolve. The
  // items exist by now: `createOrder` has committed, which is what makes position-to-id resolution
  // an ordinary query here rather than the problem the manual create form still has.
  const itemIdByPosition = new Map<number, string>();
  if (linesByPaymentIndex.size > 0) {
    for (const item of await listOrderItemPositions(orderId, userId)) {
      itemIdByPosition.set(item.position, item.id);
    }
  }

  let recorded = 0;
  let skipped = 0;
  let breakdownDropped = 0;
  const skippedBreakdownIndexes: number[] = [];

  for (const [paymentIndex, paymentInput] of paymentInputs.entries()) {
    const lines = linesByPaymentIndex.get(paymentIndex) ?? [];
    const resolved = lines.map((line) => ({
      orderItemId: itemIdByPosition.get(line.position),
      amountMinor: line.amountMinor,
    }));
    // A position the order's items do not carry can only mean the two sides disagree about the set
    // of products. The money still goes in without the breakdown, which is the same ordering
    // `FR-11-27a1` already chose for this family: losing a correction beats losing the payment.
    const unresolved = resolved.some((line) => line.orderItemId === undefined);
    if (unresolved) breakdownDropped += 1;

    // `allocations` goes THROUGH the schema, never beside it: `orderItemId: cuid()`,
    // `amountMinor: min(1)` and the 200-line ceiling all live there, and an id the map failed to
    // resolve has to die at this parse rather than reach Prisma.
    const parsed = orderPaymentCreateSchema.safeParse({
      orderId: paymentInput.orderId,
      amount: paymentInput.amount ?? undefined,
      paymentDate: paymentInput.paymentDate ?? undefined,
      allocations: unresolved || resolved.length === 0 ? undefined : resolved,
    });
    if (!parsed.success) {
      skipped += 1;
      if (lines.length > 0) skippedBreakdownIndexes.push(paymentIndex);
      continue;
    }

    const result = await addOrderPayment({
      orderId: parsed.data.orderId,
      userId,
      amount: parsed.data.amount,
      paymentDate: parsed.data.paymentDate,
      allocations: parsed.data.allocations,
    });
    if (result.ok) {
      recorded += 1;
    } else {
      skipped += 1;
      if (lines.length > 0) skippedBreakdownIndexes.push(paymentIndex);
    }
  }

  return { recorded, skipped, skippedBreakdownIndexes, breakdownDropped };
}
