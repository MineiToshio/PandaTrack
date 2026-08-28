import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Civil-day guard for every surface that asks "is this late?".
 *
 * All of them compare a stored `expectedDelivery*` / `expectedArrival*` — a calendar day pinned to
 * UTC midnight — against "today". `new Date()` is not that: it is a wall-clock instant, and in Lima
 * (UTC−5) it is wrong in both directions. At 10:00 it reads `15:00Z`, so a row due TODAY already
 * shows as late; at 21:00 it reads tomorrow's `02:00Z`, so a row due TOMORROW does too.
 * `getTodayStart(now, timeZone)` (`src/lib/data/dashboard/dashboardPeriods.ts`) is the repo's answer,
 * already used by the dashboard and the reminders.
 *
 * THE PAIRING IS THE POINT. Each list page has TWO consumers of that value and they must agree,
 * because they sit on the same screen: the per-row chips, and the SQL "Atrasados" filter in the list
 * query. Fix one and not the other and at 21:00 in Lima a row shows up in the filter with no chip on
 * it. That is why the query files are in the table beside their pages, and why each page is asserted
 * to hand its `timeZone` down into its own query.
 *
 * A unit test cannot catch this. `resolveArrivalState(x, y)` / `getOverdueDays(x, y)` take both
 * arguments from their caller, so they are right by construction whatever the caller passes; what can
 * regress is the CALL SITE. This guard reads the files and asserts the shape of that call site.
 *
 * Two shapes are checked, because there are two legitimate ways to be correct:
 *
 *   - RESOLVERS run `getTodayStart` themselves, an exact number of times. Exact, not "at least one":
 *     `orders/page.tsx` has two independent sections and dropping either one is the regression.
 *   - RECEIVERS take the civil day as a prop from a server parent and must not build their own. The
 *     delivery hero is a Client Component, so deriving it there would also desynchronise hydration.
 *
 * WHAT IT CANNOT SEE, by design:
 *
 *   - whether the resolved value actually reaches the components. That is dataflow, not shape: a
 *     value can be computed correctly and then dropped, and proving otherwise needs a type-level or
 *     runtime check. The component tests cover the rendering half instead.
 *   - a wall-clock `new Date()` bound to any name other than `today` / `now`, or built through a
 *     helper. The two literal spellings are the ones this repo actually writes.
 *   - `User.timezone` being null. `resolveTimeZone` then falls back to `DEFAULT_TIME_ZONE = "UTC"`,
 *     which is a partial fix (wrong in one direction instead of two) and is exactly what the
 *     dashboard and the reminders already do. `TimezoneCapture` in the app shell populates the
 *     column from the browser on first load, including for collectors who predate it.
 */

const ORDERS_PAGE = "src/app/[locale]/(app)/orders/page.tsx";
const ORDER_QUERIES = "src/lib/data/orders/orderQueries.ts";
const ORDER_DETAIL_CONTENT = "src/app/[locale]/(app)/orders/[id]/_components/OrderDetailContent.tsx";
const DELIVERIES_PAGE = "src/app/[locale]/(app)/deliveries/page.tsx";
const DELIVERY_QUERIES = "src/lib/data/deliveries/deliveryQueries.ts";
const DELIVERY_DETAIL_PAGE = "src/app/[locale]/(app)/deliveries/[id]/page.tsx";
const DELIVERY_DETAIL_HERO = "src/app/[locale]/(app)/deliveries/[id]/_components/DeliveryDetailHero.tsx";
const STORE_ACCOUNT_ADJUSTMENT_MUTATIONS = "src/lib/data/orders/storeAccountAdjustmentMutations.ts";
const PROGRESSION_QUERIES = "src/lib/data/progression/progressionQueries.ts";

/** Comments are masked first so prose about the defect is never read as the defect. */
function readSource(relativePath: string): string {
  const raw = readFileSync(join(process.cwd(), relativePath), "utf8");
  return raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

const WALL_CLOCK_TODAY = /const\s+today\s*=\s*new Date\(\s*\)/;
const WALL_CLOCK_NOW = /const\s+now\s*=\s*new Date\(\s*\)/;

/**
 * Files that resolve the civil day themselves. `anchors` are strings the file must still contain for
 * the scan to mean anything — see the self-verification test below. `needle` overrides the literal
 * scanned for by `countCalls`, for a resolver that goes through a named wrapper
 * (`resolveTodayStart`, `src/lib/notifications/reminderWindows.ts`) rather than calling
 * `getTodayStart` itself; it defaults to `"getTodayStart("`.
 */
const RESOLVERS: Array<{ path: string; calls: number; anchors: string[]; needle?: string }> = [
  // Two sections, two call sites. Anchoring on the identifier `today` instead would not restrict
  // `StoreViewDataSection` at all: it has no local of that name, it passes the value as a prop.
  { path: ORDERS_PAGE, calls: 2, anchors: ["StoreViewDataSection", "getOrdersList("] },
  { path: ORDER_QUERIES, calls: 1, anchors: ["deliveryLateOnly", "expectedDeliveryTo"] },
  // The overdue banner on the order detail, which also delegates the day count to `getOverdueDays`.
  { path: ORDER_DETAIL_CONTENT, calls: 1, anchors: ["getOverdueDays(", "OrderOverdueBanner"] },
  { path: DELIVERIES_PAGE, calls: 1, anchors: ["getDeliveriesList("] },
  { path: DELIVERY_QUERIES, calls: 1, anchors: ["overdueOnly", "expectedArrivalTo"] },
  // Resolves it for the hero three levels down, because the hero is a Client Component.
  { path: DELIVERY_DETAIL_PAGE, calls: 1, anchors: ["DeliveryDetailContent"] },
  // The "cuadrar cuenta" write (WO-11): `adjustmentDate` is the collector's own civil day, read
  // from `User.timezone` inside the same transaction, never the wall-clock instant a bare
  // `new Date()` would have stored (BR-05-29's "never rewrites the past" reads the CALENDAR day).
  {
    path: STORE_ACCOUNT_ADJUSTMENT_MUTATIONS,
    calls: 1,
    anchors: ["storeAccountAdjustment.create", "resolveTodayStart("],
    needle: "resolveTodayStart(",
  },
  // A ledger entry's `occurredOn` is the collector's civil day, and the monthly point caps are
  // grouped by it. A wall-clock instant here does not merely mislabel a row: at 21:00 in Lima on
  // the last day of a month it files the credit under the NEXT month's cap, so one month pays out
  // more than its ceiling and the next starts already spent.
  { path: PROGRESSION_QUERIES, calls: 1, anchors: ["resolveProgressionOccurredOn", "timezone: true"] },
];

/** Files handed the civil day as a prop, which must not build one of their own. */
const RECEIVERS: Array<{ path: string; anchors: string[] }> = [
  { path: DELIVERY_DETAIL_HERO, anchors: ["getDeliveryOverdueDays(", "today: Date"] },
];

/** A list page and the query behind its "Atrasados" toggle, which must share one timezone. */
const PAIRED_LISTS: Array<{ page: string; query: string }> = [
  { page: ORDERS_PAGE, query: ORDER_QUERIES },
  { page: DELIVERIES_PAGE, query: DELIVERY_QUERIES },
];

function countCalls(source: string, needle: string): number {
  return source.split(needle).length - 1;
}

describe("civil-day guard", () => {
  /**
   * Read first, assert second. A `readFileSync` on a path that has moved throws, but a scan whose
   * ANCHOR has been renamed would go quietly green over a file it no longer understands, which is
   * how a guard ends up protecting nothing.
   */
  it.each([...RESOLVERS, ...RECEIVERS])("is reading the file it thinks it is reading: $path", ({ path, anchors }) => {
    const source = readSource(path);

    expect(source.length).toBeGreaterThan(0);
    anchors.forEach((anchor) => expect(source).toContain(anchor));
  });

  it.each(RESOLVERS)("resolves the collector's civil day in $path", ({ path, calls, needle }) => {
    expect(countCalls(readSource(path), needle ?? "getTodayStart(")).toBe(calls);
  });

  it.each(RESOLVERS)("never derives today from a wall-clock instant in $path", ({ path }) => {
    const source = readSource(path);

    expect(source).not.toMatch(WALL_CLOCK_TODAY);
    expect(source).not.toMatch(WALL_CLOCK_NOW);
  });

  it.each(RECEIVERS)("takes the civil day as a prop instead of building one in $path", ({ path }) => {
    const source = readSource(path);

    expect(source).not.toMatch(/new Date\(/);
    expect(source).not.toContain("getTodayStart(");
  });

  it.each(PAIRED_LISTS)("binds chip and SQL filter to the same timezone: $page", ({ page, query }) => {
    // The page hands its timezone to the query, and the query resolves the same civil day from it.
    expect(readSource(page)).toMatch(/timeZone:\s*preferences\?\.timezone/);
    expect(readSource(query)).toContain("getTodayStart(new Date(), timeZone)");
  });
});
