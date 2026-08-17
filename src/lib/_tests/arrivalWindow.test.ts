import { describe, expect, it } from "vitest";
import { formatExpectedArrival, getOverdueDays, resolveArrivalState } from "@/lib/arrivalWindow";
import { addUtcDays, utcMidnightToday } from "@/test/domainDateFixtures";

/**
 * A domain date is a calendar day at UTC midnight, so the fixtures below are built with `Date.UTC`
 * and never with a parsed string or a clock reading (PLAYBOOK L077). `utcMidnightToday` /
 * `addUtcDays` are used wherever the value under test is "today"; a fixed calendar month cannot be
 * expressed with those, and the whole point of T1 is that the month has a specific length.
 */
function utcDay(year: number, monthIndex: number, day: number): Date {
  return new Date(Date.UTC(year, monthIndex, day));
}

/**
 * T1 — a range that spans a WHOLE month is the encoding of that month, and is rendered as one.
 *
 * The order form offers "este mes" / "el próximo mes" presets that write `startOfMonth` →
 * `endOfMonth`, and 48 of the collector's 62 dated windows are exactly that shape. Printing them as
 * "1–30 sep" states a day-level promise nobody made.
 *
 * All four month lengths are covered on purpose: an implementation that tests `getUTCDate() === 30`
 * passes a September-only test and then mis-reads 23 real rows. `referenceYear` is pinned to each
 * fixture's OWN year so the year suffix cannot contaminate the "no digits" assertion — the leap-year
 * case with `referenceYear: 2026` would print "feb 2028" and fail for the wrong reason, and the
 * instinctive repair would be to weaken the assertion to `toContain("feb")`, which "1–29 feb" also
 * passes.
 */
describe("formatExpectedArrival collapses a whole month to the month (T1)", () => {
  const cases: Array<[string, Date, Date, number, string]> = [
    ["30-day month (17 real rows)", utcDay(2026, 8, 1), utcDay(2026, 8, 30), 2026, "sep"],
    ["28-day February (5 real rows)", utcDay(2026, 1, 1), utcDay(2026, 1, 28), 2026, "feb"],
    ["31-day month (18 real rows)", utcDay(2026, 6, 1), utcDay(2026, 6, 31), 2026, "jul"],
    ["29-day leap February (the predicate's edge)", utcDay(2028, 1, 1), utcDay(2028, 1, 29), 2028, "feb"],
  ];

  it.each(cases)("%s", (_label, from, to, referenceYear, month) => {
    const result = formatExpectedArrival(from, to, "es", referenceYear);

    expect(result).toContain(month);
    // The hard half: no day numbers survive. `toContain(month)` alone would pass on "1–30 sep".
    expect(result).not.toMatch(/\d/);
  });
});

/**
 * T2 — the negative twin of T1. Without it, T1 is satisfied by a formatter that collapses
 * everything, and the 11 rows where the collector DID state precise days would lose it.
 */
describe("formatExpectedArrival keeps an irregular window's days (T2)", () => {
  it("does not collapse 20 sep - 31 oct, even though it ends on a month's last day", () => {
    const result = formatExpectedArrival(utcDay(2026, 8, 20), utcDay(2026, 9, 31), "es", 2026);

    expect(result).toContain("20");
  });
});

/**
 * T3 — the year rule holds in every branch, including the one that crosses it.
 *
 * The cross-year case is the one that catches an implementation delegating the irregular branch to
 * `formatArrivalWindow`, which never prints a year at all: "20 dic – 16 ene" over a 13-month horizon
 * says nothing about which January. Two real rows have that shape.
 */
describe("formatExpectedArrival prints the year only when it is not the reader's (T3)", () => {
  it("prints it on a whole month of another year", () => {
    expect(formatExpectedArrival(utcDay(2027, 8, 1), utcDay(2027, 8, 30), "es", 2026)).toContain("2027");
  });

  it("omits it on a whole month of the reader's own year", () => {
    expect(formatExpectedArrival(utcDay(2026, 8, 1), utcDay(2026, 8, 30), "es", 2026)).not.toContain("2026");
  });

  it("gives an irregular window that crosses the year BOTH years", () => {
    const result = formatExpectedArrival(utcDay(2026, 11, 20), utcDay(2027, 0, 16), "es", 2026);

    expect(result).toContain("2026");
    expect(result).toContain("2027");
  });

  it("prints it once, at the end, on a single promised day of another year", () => {
    expect(formatExpectedArrival(utcDay(2027, 5, 12), utcDay(2027, 5, 12), "es", 2026)).toContain("2027");
  });
});

/**
 * T4 — the arithmetic of "late", on both sides of the boundary.
 *
 * The `-1` case is the one that can actually die: with `dueDate === today` the early
 * `if (diff <= 0) return 0` returns before the `Math.ceil` ever runs, so an off-by-one planted in
 * the ceiling is invisible from the boundary alone.
 */
describe("overdue arithmetic (T4)", () => {
  it("does not call an order due TODAY late", () => {
    const today = utcMidnightToday();

    expect(
      resolveArrivalState({ deliveryState: "open", expectedDeliveryFrom: null, expectedDeliveryTo: today }, today),
    ).toBe("scheduled");
    expect(getOverdueDays(today, today)).toBe(0);
  });

  it("counts one whole day on an order that was due yesterday", () => {
    const today = utcMidnightToday();

    expect(getOverdueDays(addUtcDays(today, -1), today)).toBe(1);
  });

  it("turns overdue the day after the window closes, and only then", () => {
    const today = utcMidnightToday();
    const open = { deliveryState: "open" as const, expectedDeliveryFrom: null };

    expect(resolveArrivalState({ ...open, expectedDeliveryTo: addUtcDays(today, -1) }, today)).toBe("overdue");
    expect(resolveArrivalState({ ...open, expectedDeliveryTo: today }, today)).toBe("scheduled");
  });

  /**
   * The merge of `soon` into `scheduled`, asserted as an ABSENCE of behaviour.
   *
   * `soon` existed to carry a "Pronto" chip. Once the row became one line of text, it rendered the
   * same sentence as `scheduled` ("Llega {ventana}"), so the only thing left to separate them was
   * colour — the WCAG 1.4.1 violation the chip had been introduced to avoid in the first place.
   * Without this case the merge is invisible and the horizon grows back the first time someone
   * wants to "highlight what is close".
   */
  it("singles out no near horizon: 30 days and 31 days read the same", () => {
    const today = utcMidnightToday();
    const open = { deliveryState: "open" as const, expectedDeliveryFrom: null };

    expect(resolveArrivalState({ ...open, expectedDeliveryTo: addUtcDays(today, 30) }, today)).toBe("scheduled");
    expect(resolveArrivalState({ ...open, expectedDeliveryTo: addUtcDays(today, 31) }, today)).toBe("scheduled");
  });
});

/**
 * T5 — an observed delivery event RESOLVES the prediction, and the prediction stops being scored.
 *
 * The first four fixtures are the collector's real `arrived_at_store` rows. Two of them are past
 * their window, and under a scheme without this state they render a delay counter that keeps growing
 * over a product sitting on a shelf. The other two are worse than incoherent: their window is in the
 * FUTURE, so they would announce "llega sep 2026" about something that already arrived.
 *
 * `in_transit` is in the same branch on purpose. There are zero such rows today, but
 * `isItemEligibleForDelivery` lists them, and if "already at the store" answers the question then
 * "already shipped" answers it too.
 */
describe("a resolved prediction stops predicting (T5)", () => {
  const today = utcMidnightToday();

  it("does not score a product already at the store whose window closed 65 days ago", () => {
    expect(
      resolveArrivalState(
        {
          deliveryState: "arrived_at_store",
          expectedDeliveryFrom: addUtcDays(today, -65),
          expectedDeliveryTo: addUtcDays(today, -65),
        },
        today,
      ),
    ).toBe("resolved");
  });

  it("does not score one whose window closed 24 days ago either", () => {
    expect(
      resolveArrivalState(
        {
          deliveryState: "arrived_at_store",
          expectedDeliveryFrom: addUtcDays(today, -24),
          expectedDeliveryTo: addUtcDays(today, -24),
        },
        today,
      ),
    ).toBe("resolved");
  });

  it("does not announce a FUTURE arrival for a product already at the store", () => {
    expect(
      resolveArrivalState(
        {
          deliveryState: "arrived_at_store",
          expectedDeliveryFrom: addUtcDays(today, 16),
          expectedDeliveryTo: addUtcDays(today, 45),
        },
        today,
      ),
    ).toBe("resolved");
  });

  it("resolves a product at the store that never had a window at all", () => {
    // It used to fall to `noDate` here, because the state still PRINTED the window and had nothing
    // to print without one. Now that it states the event instead, the sentence is as true without a
    // window as with one, and three of the collector's seven at-the-store rows are dateless: under
    // the old branch two products on the same shelf read "Sin fecha estimada" and "Ya llegó a la
    // tienda" for a reason nothing on screen explains.
    expect(
      resolveArrivalState(
        { deliveryState: "arrived_at_store", expectedDeliveryFrom: null, expectedDeliveryTo: null },
        today,
      ),
    ).toBe("resolved");
  });

  it("still calls a WAITING product with no window `noDate`", () => {
    // The control for the case above: without it, it would pass against a resolver that answered
    // "resolved" for every dateless row, which is the opposite defect.
    expect(
      resolveArrivalState({ deliveryState: "open", expectedDeliveryFrom: null, expectedDeliveryTo: null }, today),
    ).toBe("noDate");
  });

  it("treats a shipped product the same way, whatever its window said", () => {
    expect(
      resolveArrivalState(
        {
          deliveryState: "in_transit",
          expectedDeliveryFrom: null,
          expectedDeliveryTo: addUtcDays(today, -200),
        },
        today,
      ),
    ).toBe("resolved");
  });

  it("still scores an open product with the same window", () => {
    // The control: without it, every assertion above passes against a resolver that returns
    // "resolved" for everything.
    expect(
      resolveArrivalState(
        { deliveryState: "open", expectedDeliveryFrom: null, expectedDeliveryTo: addUtcDays(today, -65) },
        today,
      ),
    ).toBe("overdue");
  });

  /**
   * H3 — `delivered` is an event further along the same chain as `arrived_at_store` / `in_transit`,
   * and `isOrderArrivalObserved` (the order-level counterpart this function's own JSDoc says shares
   * "the same rule") already treats it as observed. Without this branch a `delivered` product past
   * its window would fall through to `overdue` and print "Atrasado N días" over a product already in
   * the collector's hands — the exact class of bug ADR 0030 §3 exists to prevent, just reached by an
   * input this resolver had not been asked about yet. No live row exercises this today: the "Por
   * tienda" query filters `delivered` items out before this function sees one, and the optimistic
   * toggle that is its other caller only ever produces `open` or `arrived_at_store`.
   */
  it("does not score a DELIVERED product either, whatever its window said", () => {
    expect(
      resolveArrivalState(
        {
          deliveryState: "delivered",
          expectedDeliveryFrom: null,
          expectedDeliveryTo: addUtcDays(today, -65),
        },
        today,
      ),
    ).toBe("resolved");
  });

  it("does not announce a FUTURE arrival for a delivered product either", () => {
    expect(
      resolveArrivalState(
        {
          deliveryState: "delivered",
          expectedDeliveryFrom: addUtcDays(today, 16),
          expectedDeliveryTo: addUtcDays(today, 45),
        },
        today,
      ),
    ).toBe("resolved");
  });
});
