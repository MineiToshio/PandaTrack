/**
 * `DATE_NOT_UTC_MIDNIGHT` is a refusal only a bug can reach, and the interface cannot explain it:
 * the collector gets a generic "validation" toast and the row is never written, so nothing survives
 * for anyone to inspect afterwards. These tests pin the trace that makes it diagnosable, and pin the
 * silence on the normal path so the report stays a signal.
 *
 * Exercised through the real schemas the server actions parse, not through `domainDateSchema` on its
 * own: the refinement lives one `.refine` chain and one object schema away from the call site, and a
 * check that runs in isolation but not inside `deliveryMarkDeliveredSchema` would be worth nothing.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const { captureExceptionMock } = vi.hoisted(() => ({ captureExceptionMock: vi.fn() }));

// Only `captureException`, matching what every action test in the repo already stubs: this schema
// is reachable from most of them, so it must not need a wider mock than they provide.
vi.mock("@sentry/nextjs", () => ({ captureException: captureExceptionMock }));

import { deliveryMarkDeliveredSchema } from "@/lib/deliveries/deliveryValidation";
import { orderPaymentCreateSchema } from "@/lib/orders/orderValidation";
import { toDomainDate } from "@/lib/domainDate";

const DELIVERY_ID = "clw0000000000000000000000";

/** What a date picker in Lima (UTC-5) hands a Server Action when nobody calls `toDomainDate`. */
const LIMA_LOCAL_MIDNIGHT = new Date("2026-08-10T05:00:00.000Z");

describe("domainDateSchema refusal telemetry", () => {
  beforeEach(() => {
    captureExceptionMock.mockClear();
  });

  it("reports a non-midnight domain date, with the time-of-day and without the calendar day", () => {
    const result = deliveryMarkDeliveredSchema.safeParse({
      deliveryId: DELIVERY_ID,
      receivedDate: LIMA_LOCAL_MIDNIGHT,
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toContain("DATE_NOT_UTC_MIDNIGHT");

    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
    const [captured, options] = captureExceptionMock.mock.calls[0] as [
      Error,
      { tags: Record<string, string>; contexts: Record<string, Record<string, unknown>> },
    ];
    // An Error, not a message: the stack is what names the action that parsed an un-normalized date.
    expect(captured).toBeInstanceOf(Error);
    expect(captured.message).toContain("DATE_NOT_UTC_MIDNIGHT");
    expect(captured.stack).toBeTruthy();

    expect(options.tags).toMatchObject({ feature: "domain-date" });
    expect(options.contexts.domainDate).toEqual({ timeOfDayUtc: "05:00:00.000" });
    // The collector's calendar day is their data and is not what is broken.
    expect(JSON.stringify(captureExceptionMock.mock.calls)).not.toContain("2026-08-10");
  });

  it("says nothing on the normalized value every client path actually sends", () => {
    // `toDomainDate` is the conversion the client owes the server; this is the whole normal path.
    const result = orderPaymentCreateSchema.safeParse({
      orderId: DELIVERY_ID,
      amount: 1_000,
      paymentDate: toDomainDate(new Date(2026, 7, 10)),
    });

    expect(result.success).toBe(true);
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });

  it("says nothing when the field is absent or unparseable, so a plain type error is not reported as drift", () => {
    expect(deliveryMarkDeliveredSchema.safeParse({ deliveryId: DELIVERY_ID }).success).toBe(false);
    expect(deliveryMarkDeliveredSchema.safeParse({ deliveryId: DELIVERY_ID, receivedDate: "nope" }).success).toBe(
      false,
    );
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });
});
