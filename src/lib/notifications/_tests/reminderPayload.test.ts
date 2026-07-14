import { describe, expect, it, vi } from "vitest";
import { NotificationSubjectType, NotificationType } from "../../../../generated/prisma/client";
import { composeReminderPayload } from "../reminderPayload";

describe("composeReminderPayload", () => {
  it("deep-links an order reminder to the order detail in the collector's locale", () => {
    const translate = vi.fn((key: string) => key);

    const payload = composeReminderPayload({
      type: NotificationType.PAYMENT_DUE,
      subjectType: NotificationSubjectType.ORDER,
      subjectId: "order-1",
      locale: "en",
      descriptor: "Panda Store",
      translate,
    });

    expect(payload.url).toBe("/en/orders/order-1");
    expect(payload.tag).toBe("PAYMENT_DUE:order-1");
    expect(translate).toHaveBeenCalledWith("paymentDue.title", { subject: "Panda Store" });
    expect(translate).toHaveBeenCalledWith("paymentDue.body", { subject: "Panda Store" });
  });

  it("deep-links a delivery reminder to the delivery detail", () => {
    const payload = composeReminderPayload({
      type: NotificationType.ARRIVAL_DUE,
      subjectType: NotificationSubjectType.DELIVERY,
      subjectId: "delivery-9",
      locale: "es",
      descriptor: "Tienda Bogota",
      translate: (key) => key,
    });

    expect(payload.url).toBe("/es/deliveries/delivery-9");
    expect(payload.tag).toBe("ARRIVAL_DUE:delivery-9");
  });

  it("carries only presentational fields and never money or note text (no-money invariant)", () => {
    // The composer only ever receives a currency-free descriptor, so the payload cannot
    // leak money. Assert the exact key set and that the interpolation input is the
    // descriptor alone.
    const translate = vi.fn((key: string, values?: Record<string, string>) =>
      values ? `${key}:${values.subject}` : key,
    );

    const payload = composeReminderPayload({
      type: NotificationType.ARRIVAL_OVERDUE,
      subjectType: NotificationSubjectType.ORDER,
      subjectId: "order-2",
      locale: "es",
      descriptor: "Kyoto Imports",
      translate,
    });

    expect(Object.keys(payload).sort()).toEqual(["body", "tag", "title", "url"]);
    for (const call of translate.mock.calls) {
      const values = call[1];
      if (values) {
        expect(Object.keys(values)).toEqual(["subject"]);
        expect(values.subject).toBe("Kyoto Imports");
      }
    }
  });
});
