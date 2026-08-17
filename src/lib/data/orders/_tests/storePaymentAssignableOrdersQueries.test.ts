import { describe, expect, it } from "vitest";
import { computeRestCeilingMinor } from "../storePaymentAssignableOrdersQueries";

/**
 * The "Resto del pedido" ceiling. The rule this pins down is that it keys off ARITHMETIC, never off
 * how many products an order has: `resolveBasePagableMinor` reads `unitPrice` before it falls back
 * to the order total, so a single-product order with a price plus shipping already has a base
 * smaller than its total and would strand its shipping outside every reachable ceiling without it.
 */
describe("computeRestCeilingMinor", () => {
  it("is 0 when the products' bases add up to the whole assignable balance", () => {
    expect(
      computeRestCeilingMinor({
        assignableMinor: 10000,
        items: [
          { basePagableMinor: 6000, allocatedMinor: 0 },
          { basePagableMinor: 4000, allocatedMinor: 0 },
        ],
      }),
    ).toBe(0);
  });

  it("opens the rest line for a SINGLE product with a price plus shipping", () => {
    // Unit price 100.00 on an order that cost 118.00 — the 18.00 of shipping has nowhere else to go.
    expect(
      computeRestCeilingMinor({ assignableMinor: 11800, items: [{ basePagableMinor: 10000, allocatedMinor: 0 }] }),
    ).toBe(1800);
  });

  it("opens the rest line across several products that under-cover their order", () => {
    expect(
      computeRestCeilingMinor({
        assignableMinor: 10000,
        items: [
          { basePagableMinor: 3000, allocatedMinor: 0 },
          { basePagableMinor: 2000, allocatedMinor: 0 },
        ],
      }),
    ).toBe(5000);
  });

  it("closes the rest line when a product has no price, because it can absorb the whole order", () => {
    expect(
      computeRestCeilingMinor({ assignableMinor: 10000, items: [{ basePagableMinor: null, allocatedMinor: 0 }] }),
    ).toBe(0);
  });

  it("counts only what a product still has left of its base", () => {
    expect(
      computeRestCeilingMinor({ assignableMinor: 4000, items: [{ basePagableMinor: 6000, allocatedMinor: 5000 }] }),
    ).toBe(3000);
  });

  it("never lets an over-allocated product borrow ceiling from its siblings", () => {
    expect(
      computeRestCeilingMinor({
        assignableMinor: 5000,
        items: [
          { basePagableMinor: 1000, allocatedMinor: 4000 },
          { basePagableMinor: 2000, allocatedMinor: 0 },
        ],
      }),
    ).toBe(3000);
  });

  it("opens the rest line for an order with no products at all", () => {
    expect(computeRestCeilingMinor({ assignableMinor: 7500, items: [] })).toBe(7500);
  });
});
