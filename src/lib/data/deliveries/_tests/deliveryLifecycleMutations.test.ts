import { describe, expect, it, vi, beforeEach } from "vitest";
import { DeliveryStatus, OrderItemDeliveryState } from "../../../../../generated/prisma/client";
import {
  cancelDelivery,
  deleteDelivery,
  markDeliveryDelivered,
  reopenDelivery,
  updateDeliveryNote,
} from "../deliveryMutations";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

type TxMock = {
  delivery: {
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  orderItem: { updateMany: ReturnType<typeof vi.fn> };
  deliveryOrderItem: { count: ReturnType<typeof vi.fn> };
  order: { findMany: ReturnType<typeof vi.fn>; updateMany: ReturnType<typeof vi.fn> };
};

function makeTx(overrides: Partial<{ delivery: unknown; conflictCount: number }> = {}): TxMock {
  return {
    delivery: {
      findFirst: vi.fn().mockResolvedValue(overrides.delivery ?? null),
      update: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    },
    orderItem: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    deliveryOrderItem: { count: vi.fn().mockResolvedValue(overrides.conflictCount ?? 0) },
    // No matching orders → persistDerivedOrderStatuses skips; derivation itself is covered
    // by the existing persistDerivedOrderStatuses suite.
    order: {
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      update: vi.fn().mockResolvedValue(undefined),
    },
    // WO-08 (FR-08-43): reopenDelivery now looks up and deletes settlement StorePayment rows in the
    // same transaction. None of this file's fixtures produced a settlement, so an empty result here
    // keeps every existing scenario's behavior unchanged; the settlement-reversal scoping itself has
    // its own dedicated coverage in deliveryMutations.test.ts.
    storePayment: { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    // WO-08 gap closure: reopenDelivery also reads (never deletes) allocations this delivery's own
    // close-time consumption stamped. None of this file's fixtures produced one, so an empty result
    // keeps every existing scenario's behavior unchanged; the surviving-consumption read itself has
    // its own dedicated coverage in deliveryMutations.test.ts.
    paymentAllocation: { groupBy: vi.fn().mockResolvedValue([]), findMany: vi.fn().mockResolvedValue([]) },
  } as unknown as TxMock;
}

function useTx(tx: TxMock) {
  prismaMock.$transaction.mockImplementation(async (fn: (t: unknown) => Promise<unknown>) => fn(tx));
}

function deliveryFixture(status: DeliveryStatus) {
  return {
    id: "dlv-1",
    status,
    orderItems: [{ orderItem: { id: "item-1", orderId: "ord-1" } }, { orderItem: { id: "item-2", orderId: "ord-2" } }],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("markDeliveryDelivered", () => {
  it("returns DELIVERY_NOT_FOUND when the delivery does not belong to the user", async () => {
    useTx(makeTx({ delivery: null }));
    const result = await markDeliveryDelivered("dlv-1", "user-1", new Date());
    expect(result).toEqual({ ok: false, error: "DELIVERY_NOT_FOUND" });
  });

  it("rejects non IN_TRANSIT deliveries", async () => {
    useTx(makeTx({ delivery: deliveryFixture(DeliveryStatus.DELIVERED) }));
    const result = await markDeliveryDelivered("dlv-1", "user-1", new Date());
    expect(result).toEqual({ ok: false, error: "INVALID_STATUS" });
  });

  it("persists the received date and moves items to DELIVERED", async () => {
    const tx = makeTx({ delivery: deliveryFixture(DeliveryStatus.IN_TRANSIT) });
    useTx(tx);
    const receivedDate = new Date(2026, 4, 20);

    const result = await markDeliveryDelivered("dlv-1", "user-1", receivedDate);

    // closedOrders is [] here: this fixture's orders never resolve (order.findMany → []), so
    // nothing derives to COMPLETED; the producer-snapshot behavior itself is covered in
    // deliveryMutations.test.ts.
    expect(result).toEqual({ ok: true, productCount: 2, closedOrders: [] });
    expect(tx.delivery.update).toHaveBeenCalledWith({
      where: { id: "dlv-1" },
      data: { status: DeliveryStatus.DELIVERED, receivedDate },
    });
    expect(tx.orderItem.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["item-1", "item-2"] }, userId: "user-1" },
      data: { deliveryState: OrderItemDeliveryState.DELIVERED },
    });
  });
});

describe("reopenDelivery", () => {
  it("rejects IN_TRANSIT deliveries", async () => {
    useTx(makeTx({ delivery: deliveryFixture(DeliveryStatus.IN_TRANSIT) }));
    const result = await reopenDelivery("dlv-1", "user-1");
    expect(result).toEqual({ ok: false, error: "INVALID_STATUS" });
  });

  it("reopens a DELIVERED delivery: clears receivedDate and moves items to IN_TRANSIT", async () => {
    const tx = makeTx({ delivery: deliveryFixture(DeliveryStatus.DELIVERED) });
    useTx(tx);

    const result = await reopenDelivery("dlv-1", "user-1");

    // No settlement StorePayment for this delivery in this fixture; the settlement-reversal
    // scoping itself (FR-08-43) has its own dedicated coverage in deliveryMutations.test.ts.
    expect(result).toEqual({
      ok: true,
      productCount: 2,
      revertedSettlements: {
        totalAmountMinor: 0,
        payments: [],
        survivingConsumedMinor: 0,
        survivingConsumedAllocations: [],
      },
    });
    expect(tx.delivery.update).toHaveBeenCalledWith({
      where: { id: "dlv-1" },
      data: { status: DeliveryStatus.IN_TRANSIT, receivedDate: null },
    });
    expect(tx.orderItem.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["item-1", "item-2"] }, userId: "user-1" },
      data: { deliveryState: OrderItemDeliveryState.IN_TRANSIT },
    });
    // DELIVERED → reopen never checks for membership conflicts.
    expect(tx.deliveryOrderItem.count).not.toHaveBeenCalled();
  });

  it("rejects reopening a CANCELLED delivery whose items joined another live delivery", async () => {
    const tx = makeTx({ delivery: deliveryFixture(DeliveryStatus.CANCELLED), conflictCount: 1 });
    useTx(tx);

    const result = await reopenDelivery("dlv-1", "user-1");

    expect(result).toEqual({ ok: false, error: "PRODUCTS_IN_OTHER_DELIVERY" });
    expect(tx.delivery.update).not.toHaveBeenCalled();
  });

  it("reopens a CANCELLED delivery when items are still free", async () => {
    const tx = makeTx({ delivery: deliveryFixture(DeliveryStatus.CANCELLED), conflictCount: 0 });
    useTx(tx);

    const result = await reopenDelivery("dlv-1", "user-1");

    expect(result).toEqual({
      ok: true,
      productCount: 2,
      revertedSettlements: {
        totalAmountMinor: 0,
        payments: [],
        survivingConsumedMinor: 0,
        survivingConsumedAllocations: [],
      },
    });
    expect(tx.deliveryOrderItem.count).toHaveBeenCalledWith({
      where: {
        orderItemId: { in: ["item-1", "item-2"] },
        deliveryId: { not: "dlv-1" },
        delivery: { status: { not: DeliveryStatus.CANCELLED } },
      },
    });
  });
});

describe("cancelDelivery", () => {
  it("rejects non IN_TRANSIT deliveries", async () => {
    useTx(makeTx({ delivery: deliveryFixture(DeliveryStatus.CANCELLED) }));
    const result = await cancelDelivery("dlv-1", "user-1");
    expect(result).toEqual({ ok: false, error: "INVALID_STATUS" });
  });

  it("cancels and returns items to ARRIVED_AT_STORE", async () => {
    const tx = makeTx({ delivery: deliveryFixture(DeliveryStatus.IN_TRANSIT) });
    useTx(tx);

    const result = await cancelDelivery("dlv-1", "user-1");

    expect(result).toEqual({ ok: true, productCount: 2 });
    expect(tx.delivery.update).toHaveBeenCalledWith({
      where: { id: "dlv-1" },
      data: { status: DeliveryStatus.CANCELLED },
    });
    expect(tx.orderItem.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["item-1", "item-2"] }, userId: "user-1" },
      data: { deliveryState: OrderItemDeliveryState.ARRIVED_AT_STORE },
    });
  });
});

describe("deleteDelivery", () => {
  it("rejects DELIVERED deliveries (reopen first)", async () => {
    useTx(makeTx({ delivery: deliveryFixture(DeliveryStatus.DELIVERED) }));
    const result = await deleteDelivery("dlv-1", "user-1");
    expect(result).toEqual({ ok: false, error: "INVALID_STATUS" });
  });

  it("deletes an IN_TRANSIT delivery and returns items to ARRIVED_AT_STORE", async () => {
    const tx = makeTx({ delivery: deliveryFixture(DeliveryStatus.IN_TRANSIT) });
    useTx(tx);

    const result = await deleteDelivery("dlv-1", "user-1");

    expect(result).toEqual({ ok: true, productCount: 2 });
    expect(tx.orderItem.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["item-1", "item-2"] }, userId: "user-1" },
      data: { deliveryState: OrderItemDeliveryState.ARRIVED_AT_STORE },
    });
    expect(tx.delivery.delete).toHaveBeenCalledWith({ where: { id: "dlv-1" } });
  });

  it("deletes a CANCELLED delivery without touching item states", async () => {
    const tx = makeTx({ delivery: deliveryFixture(DeliveryStatus.CANCELLED) });
    useTx(tx);

    const result = await deleteDelivery("dlv-1", "user-1");

    expect(result).toEqual({ ok: true, productCount: 2 });
    expect(tx.orderItem.updateMany).not.toHaveBeenCalled();
    expect(tx.delivery.delete).toHaveBeenCalledWith({ where: { id: "dlv-1" } });
  });
});

describe("updateDeliveryNote", () => {
  function makeNoteTx(existingNote: string | null) {
    const updatedAt = new Date(2026, 5, 1);
    return {
      delivery: {
        findFirst: vi.fn().mockResolvedValue({ note: existingNote, updatedAt }),
        update: vi.fn().mockResolvedValue({ updatedAt: new Date(2026, 5, 2) }),
        delete: vi.fn(),
      },
      orderItem: { updateMany: vi.fn() },
      deliveryOrderItem: { count: vi.fn() },
      order: { findMany: vi.fn().mockResolvedValue([]), updateMany: vi.fn() },
    };
  }

  it("is a no-op when the trimmed note did not change", async () => {
    const tx = makeNoteTx("hello");
    useTx(tx as unknown as TxMock);

    const result = await updateDeliveryNote("dlv-1", "user-1", "  hello  ");

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.changed).toBe(false);
    expect(tx.delivery.update).not.toHaveBeenCalled();
  });

  it("persists a new note and clears with empty input", async () => {
    const tx = makeNoteTx("old");
    useTx(tx as unknown as TxMock);

    const saved = await updateDeliveryNote("dlv-1", "user-1", "new note");
    expect(saved.ok).toBe(true);
    if (saved.ok) expect(saved.note).toBe("new note");

    const cleared = await updateDeliveryNote("dlv-1", "user-1", "   ");
    expect(cleared.ok).toBe(true);
    if (cleared.ok) expect(cleared.note).toBeNull();
  });
});
