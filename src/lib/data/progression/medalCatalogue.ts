/**
 * The medal catalogue: twenty-four pieces across six series, and the pure rules over them.
 *
 * This module is a LEAF, exactly like `pointRules.ts` and `rankLadder.ts`: it imports nothing, reads
 * no database and never names a monetary field, and `src/test/progression-money-guard.test.ts`
 * scans it to keep that true. A medal that could see what a collector spent would turn the album
 * into a spending scoreboard, which is the one thing this whole feature is not.
 *
 * The consequence is the split you see here: a medal declares the CONDITION it needs by key, and
 * somebody else (`medalEvaluation.ts`) resolves those keys against the database and hands back the
 * set that currently holds. Money-derived conditions arrive through `moneyPredicateAdapter.ts` as
 * booleans on that path, never as a figure, and never through this file.
 *
 * Two counts live here and they are deliberately different numbers:
 *
 *   - `getShippedMedalCount()` is how many medals this build can actually award. It is the album's
 *     denominator, and it is a function rather than a constant because the catalogue grows.
 *   - `getMeritLockDenominator()` is the rank ladder's denominator, which is the shipped count minus
 *     the pieces a collector cannot reach on their own (a medal that waits on somebody else's
 *     action, an event whose window has closed), unless they already hold them.
 */

/** The five print-run grades. Stable keys; the display names live in `progress.json`. */
export const MEDAL_RARITIES = {
  NORMAL: "normal",
  FIRST_PRINT: "first-print",
  LIMITED: "limited",
  HOLO: "holo",
  SIGNED: "signed",
} as const;

export type MedalRarity = (typeof MEDAL_RARITIES)[keyof typeof MEDAL_RARITIES];

/** Ascending rarity, and the order the rarity legend renders in. */
export const MEDAL_RARITY_ORDER: readonly MedalRarity[] = [
  MEDAL_RARITIES.NORMAL,
  MEDAL_RARITIES.FIRST_PRINT,
  MEDAL_RARITIES.LIMITED,
  MEDAL_RARITIES.HOLO,
  MEDAL_RARITIES.SIGNED,
];

/** The six album pages. Series are the only grouping the album offers. */
export const MEDAL_SERIES = {
  FIRST_STEPS: "first-steps",
  THE_WAIT: "the-wait",
  THE_DISPLAY_CASE: "the-display-case",
  EXPLORER: "explorer",
  CHRONICLER: "chronicler",
  SECRETS: "secrets",
} as const;

export type MedalSeries = (typeof MEDAL_SERIES)[keyof typeof MEDAL_SERIES];

/** Series in album order. The album renders its pages in exactly this sequence. */
export const MEDAL_SERIES_ORDER: readonly MedalSeries[] = [
  MEDAL_SERIES.FIRST_STEPS,
  MEDAL_SERIES.THE_WAIT,
  MEDAL_SERIES.THE_DISPLAY_CASE,
  MEDAL_SERIES.EXPLORER,
  MEDAL_SERIES.CHRONICLER,
  MEDAL_SERIES.SECRETS,
];

/**
 * A medal's condition, by key.
 *
 * Named rather than written as a predicate for the same reason the point rules are: a predicate
 * would need the rows, the rows need a query, and a query is an import this module may not have.
 * `medalEvaluation.ts` owns exactly one resolver per key listed here.
 */
export const MEDAL_CONDITIONS = {
  /** One order exists at a store that may credit (`BR-12-07`). */
  ANY_ORDER: "any-order",
  /** One order at a creditable store carries an assigned payment. Existence only, never an amount. */
  ANY_PAYMENT: "any-payment",
  /** One delivery from a creditable store has reached its delivered state. */
  ANY_ARRIVAL: "any-arrival",
  /** One order is both fully covered and fully arrived. The money half is a boolean from the adapter. */
  ORDER_FULLY_CLOSED: "order-fully-closed",
  /** A review exists for a creditable store the collector already received a product from. */
  REVIEW_AFTER_ARRIVAL: "review-after-arrival",
  /** The order this very request created carries the image-intake marker. Call-time only. */
  ORDER_FROM_IMAGE: "order-from-image",
  /** An order fully arrived 60 / 120 / 200 or more days after the day it was placed. */
  WAIT_60_DAYS: "wait-60-days",
  WAIT_120_DAYS: "wait-120-days",
  WAIT_200_DAYS: "wait-200-days",
  /** One order whose products arrived across more than one delivery. */
  SPLIT_ARRIVAL: "split-arrival",
  /** An order created between 00:00 and 04:00 of the collector's own civil day. */
  MIDNIGHT_ORDER: "midnight-order",
  /** Phase 2, no resolver in this build: delivered-product counters. */
  PRODUCTS_DELIVERED_10: "products-delivered-10",
  PRODUCTS_DELIVERED_50: "products-delivered-50",
  PRODUCTS_DELIVERED_150: "products-delivered-150",
  /** Phase 2: deliveries received. */
  ARRIVALS_25: "arrivals-25",
  /** Phase 2: distinct product types delivered. */
  PRODUCT_TYPES_3: "product-types-3",
  PRODUCT_TYPES_6: "product-types-6",
  /** Phase 2: distinct stores with at least one delivery. */
  STORES_WITH_ARRIVAL_10: "stores-with-arrival-10",
  /** Phase 2: orders whose every product field is filled in. */
  COMPLETE_RECORD_1: "complete-record-1",
  COMPLETE_RECORD_10: "complete-record-10",
  /** Phase 2: a store this collector created was approved and somebody else ordered from it. */
  STORE_ADOPTED: "store-adopted",
  /** Phase 2 secret: an order paid off and closed on the day it arrived. */
  SAME_DAY_SETTLE: "same-day-settle",
  /** Phase 2 secret: twelve consecutive civil months with at least one order. */
  YEAR_STREAK: "year-streak",
} as const;

export type MedalCondition = (typeof MEDAL_CONDITIONS)[keyof typeof MEDAL_CONDITIONS];

/**
 * Which build a medal is awardable in. Phase 2 entries are catalogued but NOT shipped: they render
 * in the album as silhouettes so half the album reads as a promise rather than as missing content
 * (`FR-12-20`), and they are excluded from every counter and from the evaluator.
 */
export type MedalPhase = 1 | 2;

export type MedalDefinition = {
  /** Stable English key. Persisted verbatim on `MedalUnlock.medalKey`; never a display name. */
  medalKey: string;
  series: MedalSeries;
  rarity: MedalRarity;
  condition: MedalCondition;
  phase: MedalPhase;
  /**
   * Whether this piece could ever appear on a public surface (`FR-12-24`). Nothing in this build
   * renders one; the flag exists so a future surface cannot be built without the classification
   * already having been made.
   */
  publicSafe: boolean;
  /**
   * The condition is a STATE, not an event. A stateful medal additionally reports whether that state
   * still holds, and never loses the unlock for having stopped holding (`FR-12-23`, `BR-12-08`).
   */
  stateful: boolean;
  /**
   * A secret piece: silhouette, no hint, neutral label, until it is unlocked (`FR-12-25`). The
   * treatment is deliberately confined to this series and must not be generalized.
   */
  secret: boolean;
  /**
   * Whether reaching it is within the collector's own reach. `false` for a medal that waits on
   * another user's action, which is what keeps `FR-12-17`'s merit lock from being gated on somebody
   * else's behaviour.
   */
  controllable: boolean;
  /**
   * Time-limited event window, from phase 3 (`FR-12-28`). Present on every row from phase 1 and
   * unset for every medal that exists today, so the shape that will hold an event already exists
   * before there is any way to author one. A window that has closed can never be reopened
   * (`BR-12-20`).
   */
  availableFrom: string | null;
  availableTo: string | null;
  /** A numbered piece stamps its ordinal at unlock time. No medal in phase 1 or 2 is numbered. */
  numbered: boolean;
  /**
   * Name of this medal's artwork, or `null` while that artwork does not exist yet.
   *
   * The single substitution point for medal art. The stage renders the real image when a key is
   * present and the sober placeholder medallion when it is not, so dropping finished artwork in
   * later is one edit per row here and no change anywhere else.
   */
  imageKey: string | null;
};

const {
  ANY_ORDER,
  ANY_PAYMENT,
  ANY_ARRIVAL,
  ORDER_FULLY_CLOSED,
  REVIEW_AFTER_ARRIVAL,
  ORDER_FROM_IMAGE,
  WAIT_60_DAYS,
  WAIT_120_DAYS,
  WAIT_200_DAYS,
  SPLIT_ARRIVAL,
  MIDNIGHT_ORDER,
  PRODUCTS_DELIVERED_10,
  PRODUCTS_DELIVERED_50,
  PRODUCTS_DELIVERED_150,
  ARRIVALS_25,
  PRODUCT_TYPES_3,
  PRODUCT_TYPES_6,
  STORES_WITH_ARRIVAL_10,
  COMPLETE_RECORD_1,
  COMPLETE_RECORD_10,
  STORE_ADOPTED,
  SAME_DAY_SETTLE,
  YEAR_STREAK,
} = MEDAL_CONDITIONS;

const { NORMAL, FIRST_PRINT, LIMITED, HOLO, SIGNED } = MEDAL_RARITIES;

/** Defaults every entry shares (phase-3 event columns of `FR-12-28`, and the art hole). */
const MEDAL_DEFAULTS = { availableFrom: null, availableTo: null, numbered: false, imageKey: null } as const;

/**
 * The twenty-four medals, in album order.
 *
 * Phase 1 ships twelve: the seven of `first-steps`, the four of `the-wait`, and one secret. The
 * secret shipping first is `midnight-order`, chosen on evaluation cost: it is a single-row check
 * over a timestamp the order already carries, where `same-day-settle` needs a cross-entity join and
 * `year-streak` a twelve-month scan (`ADR 0040`).
 */
export const MEDAL_CATALOGUE: readonly MedalDefinition[] = Object.freeze([
  // --- Primeros pasos -------------------------------------------------------------------------
  {
    medalKey: "first-order",
    series: MEDAL_SERIES.FIRST_STEPS,
    rarity: NORMAL,
    condition: ANY_ORDER,
    phase: 1,
    publicSafe: true,
    stateful: false,
    secret: false,
    controllable: true,
    ...MEDAL_DEFAULTS,
  },
  {
    medalKey: "first-payment",
    series: MEDAL_SERIES.FIRST_STEPS,
    rarity: NORMAL,
    condition: ANY_PAYMENT,
    phase: 1,
    publicSafe: true,
    stateful: false,
    secret: false,
    controllable: true,
    ...MEDAL_DEFAULTS,
  },
  {
    medalKey: "first-arrival",
    series: MEDAL_SERIES.FIRST_STEPS,
    rarity: NORMAL,
    condition: ANY_ARRIVAL,
    phase: 1,
    publicSafe: true,
    stateful: false,
    secret: false,
    controllable: true,
    ...MEDAL_DEFAULTS,
  },
  {
    medalKey: "first-order-closed",
    series: MEDAL_SERIES.FIRST_STEPS,
    rarity: NORMAL,
    condition: ORDER_FULLY_CLOSED,
    phase: 1,
    publicSafe: true,
    // Reopening a delivery puts a product back in transit and the circle is no longer closed. The
    // unlock stays; only the currency line changes (`AC-12-12`).
    stateful: true,
    secret: false,
    controllable: true,
    ...MEDAL_DEFAULTS,
  },
  {
    medalKey: "first-review",
    series: MEDAL_SERIES.FIRST_STEPS,
    rarity: NORMAL,
    condition: REVIEW_AFTER_ARRIVAL,
    phase: 1,
    publicSafe: true,
    // A review can be deleted, which is a state stopping rather than the event un-happening.
    stateful: true,
    secret: false,
    controllable: true,
    ...MEDAL_DEFAULTS,
  },
  {
    medalKey: "first-photo-order",
    series: MEDAL_SERIES.FIRST_STEPS,
    rarity: NORMAL,
    condition: ORDER_FROM_IMAGE,
    phase: 1,
    publicSafe: true,
    stateful: false,
    secret: false,
    controllable: true,
    ...MEDAL_DEFAULTS,
  },
  {
    medalKey: "first-store",
    series: MEDAL_SERIES.FIRST_STEPS,
    rarity: NORMAL,
    // The first order a collector ever places is by definition their first order at a store new to
    // them, so this reads the same fact as `first-order` rather than a second, subtly different one.
    condition: ANY_ORDER,
    phase: 1,
    publicSafe: true,
    stateful: false,
    secret: false,
    controllable: true,
    ...MEDAL_DEFAULTS,
  },

  // --- La espera ------------------------------------------------------------------------------
  {
    medalKey: "patience-60",
    series: MEDAL_SERIES.THE_WAIT,
    rarity: FIRST_PRINT,
    condition: WAIT_60_DAYS,
    phase: 1,
    publicSafe: true,
    stateful: false,
    secret: false,
    controllable: true,
    ...MEDAL_DEFAULTS,
  },
  {
    medalKey: "patience-120",
    series: MEDAL_SERIES.THE_WAIT,
    rarity: LIMITED,
    condition: WAIT_120_DAYS,
    phase: 1,
    publicSafe: true,
    stateful: false,
    secret: false,
    controllable: true,
    ...MEDAL_DEFAULTS,
  },
  {
    medalKey: "patience-200",
    series: MEDAL_SERIES.THE_WAIT,
    rarity: HOLO,
    condition: WAIT_200_DAYS,
    phase: 1,
    publicSafe: true,
    stateful: false,
    secret: false,
    controllable: true,
    ...MEDAL_DEFAULTS,
  },
  {
    medalKey: "split-arrival",
    series: MEDAL_SERIES.THE_WAIT,
    rarity: FIRST_PRINT,
    condition: SPLIT_ARRIVAL,
    phase: 1,
    publicSafe: true,
    stateful: false,
    secret: false,
    controllable: true,
    ...MEDAL_DEFAULTS,
  },

  // --- La vitrina (phase 2) -------------------------------------------------------------------
  {
    medalKey: "collection-10",
    series: MEDAL_SERIES.THE_DISPLAY_CASE,
    rarity: NORMAL,
    condition: PRODUCTS_DELIVERED_10,
    phase: 2,
    publicSafe: false,
    stateful: true,
    secret: false,
    controllable: true,
    ...MEDAL_DEFAULTS,
  },
  {
    medalKey: "collection-50",
    series: MEDAL_SERIES.THE_DISPLAY_CASE,
    rarity: FIRST_PRINT,
    condition: PRODUCTS_DELIVERED_50,
    phase: 2,
    publicSafe: false,
    stateful: true,
    secret: false,
    controllable: true,
    ...MEDAL_DEFAULTS,
  },
  {
    medalKey: "collection-150",
    series: MEDAL_SERIES.THE_DISPLAY_CASE,
    rarity: HOLO,
    condition: PRODUCTS_DELIVERED_150,
    phase: 2,
    publicSafe: false,
    stateful: true,
    secret: false,
    controllable: true,
    ...MEDAL_DEFAULTS,
  },
  {
    medalKey: "arrivals-25",
    series: MEDAL_SERIES.THE_DISPLAY_CASE,
    rarity: LIMITED,
    condition: ARRIVALS_25,
    phase: 2,
    publicSafe: false,
    stateful: true,
    secret: false,
    controllable: true,
    ...MEDAL_DEFAULTS,
  },

  // --- Explorador (phase 2) -------------------------------------------------------------------
  {
    medalKey: "variety-3",
    series: MEDAL_SERIES.EXPLORER,
    rarity: NORMAL,
    condition: PRODUCT_TYPES_3,
    phase: 2,
    publicSafe: false,
    stateful: true,
    secret: false,
    controllable: true,
    ...MEDAL_DEFAULTS,
  },
  {
    medalKey: "variety-6",
    series: MEDAL_SERIES.EXPLORER,
    rarity: LIMITED,
    condition: PRODUCT_TYPES_6,
    phase: 2,
    publicSafe: false,
    stateful: true,
    secret: false,
    controllable: true,
    ...MEDAL_DEFAULTS,
  },
  {
    medalKey: "stores-10",
    series: MEDAL_SERIES.EXPLORER,
    rarity: HOLO,
    condition: STORES_WITH_ARRIVAL_10,
    phase: 2,
    publicSafe: false,
    stateful: true,
    secret: false,
    controllable: true,
    ...MEDAL_DEFAULTS,
  },

  // --- Cronista (phase 2) ---------------------------------------------------------------------
  {
    medalKey: "clean-record-1",
    series: MEDAL_SERIES.CHRONICLER,
    rarity: NORMAL,
    condition: COMPLETE_RECORD_1,
    phase: 2,
    publicSafe: true,
    stateful: true,
    secret: false,
    controllable: true,
    ...MEDAL_DEFAULTS,
  },
  {
    medalKey: "clean-record-10",
    series: MEDAL_SERIES.CHRONICLER,
    rarity: LIMITED,
    condition: COMPLETE_RECORD_10,
    phase: 2,
    publicSafe: true,
    stateful: true,
    secret: false,
    controllable: true,
    ...MEDAL_DEFAULTS,
  },
  {
    medalKey: "store-mapped-1",
    series: MEDAL_SERIES.CHRONICLER,
    rarity: FIRST_PRINT,
    condition: STORE_ADOPTED,
    phase: 2,
    publicSafe: true,
    stateful: false,
    secret: false,
    // Waits on a stranger deciding to order from a store this collector contributed. Nothing they
    // do can make it happen, so it must not sit in the denominator of a rank gate.
    controllable: false,
    ...MEDAL_DEFAULTS,
  },

  // --- Secretas -------------------------------------------------------------------------------
  {
    medalKey: "midnight-order",
    series: MEDAL_SERIES.SECRETS,
    rarity: FIRST_PRINT,
    condition: MIDNIGHT_ORDER,
    phase: 1,
    publicSafe: true,
    stateful: false,
    secret: true,
    controllable: true,
    ...MEDAL_DEFAULTS,
  },
  {
    medalKey: "same-day-settle",
    series: MEDAL_SERIES.SECRETS,
    rarity: HOLO,
    condition: SAME_DAY_SETTLE,
    phase: 2,
    publicSafe: true,
    stateful: false,
    secret: true,
    controllable: true,
    ...MEDAL_DEFAULTS,
  },
  {
    medalKey: "year-streak",
    series: MEDAL_SERIES.SECRETS,
    rarity: SIGNED,
    condition: YEAR_STREAK,
    phase: 2,
    publicSafe: true,
    stateful: false,
    secret: true,
    controllable: true,
    ...MEDAL_DEFAULTS,
  },
]);

const MEDALS_BY_KEY = new Map<string, MedalDefinition>(MEDAL_CATALOGUE.map((medal) => [medal.medalKey, medal]));

/** The medal for a stored key, or `undefined` for a key this build no longer knows. */
export function findMedal(medalKey: string): MedalDefinition | undefined {
  return MEDALS_BY_KEY.get(medalKey);
}

/** Whether a medal can actually be awarded by this build. Phase-2 entries are catalogued, not shipped. */
export function isShippedMedal(medal: MedalDefinition): boolean {
  return medal.phase === 1;
}

/** The medals this build can award, in album order. */
export const SHIPPED_MEDALS: readonly MedalDefinition[] = MEDAL_CATALOGUE.filter(isShippedMedal);

/**
 * Medals shipped in this build, and the album's denominator.
 *
 * A function rather than a constant precisely because that count grows: reading it at evaluation
 * time is what stops a cached denominator from freezing a rank gate at an old catalogue size.
 */
export function getShippedMedalCount(): number {
  return SHIPPED_MEDALS.length;
}

/** Whether an event window is closed as of `now`. No phase-1 or phase-2 medal carries one. */
function isWindowClosed(medal: MedalDefinition, now: Date): boolean {
  return medal.availableTo !== null && new Date(medal.availableTo).getTime() < now.getTime();
}

/**
 * The rank ladder's album denominator (`FR-12-17`).
 *
 * The shipped catalogue minus the pieces this collector cannot reach on their own: a medal that
 * waits on another user's action, and any event medal whose window has closed. A piece they ALREADY
 * hold stays in the denominator whatever its state, because excluding it would silently shrink the
 * gate for the collectors who earned the hardest medals, which is backwards.
 */
export function getMeritLockDenominator(unlockedMedalKeys: readonly string[], now: Date = new Date()): number {
  const unlocked = new Set(unlockedMedalKeys);
  return SHIPPED_MEDALS.filter(
    (medal) => unlocked.has(medal.medalKey) || (medal.controllable && !isWindowClosed(medal, now)),
  ).length;
}

/** What one newly unlocked medal carries into the write and into the response. */
export type MedalUnlockCandidate = {
  medalKey: string;
  series: string;
  rarity: string;
  numbered: boolean;
};

export type SelectUnlockedMedalsInput = {
  /** Condition keys that currently hold for this collector. */
  satisfiedConditions: ReadonlySet<MedalCondition>;
  /** Keys already written to `MedalUnlock`; a medal is offered once and never re-offered. */
  alreadyUnlockedKeys: readonly string[];
  /** Evaluated against a closed event window. Defaults to now. */
  now?: Date;
};

/**
 * The medals to unlock right now, in catalogue order.
 *
 * Pure and deterministic: the same facts always yield the same list in the same order, which is
 * what lets the celebration queue consume it without inventing an ordering of its own (`FR-12-29`).
 * Nothing here returns, computes, or so much as names a point value: medals are status only
 * (`FR-12-22`, `BR-12-08`).
 */
export function selectUnlockedMedals(input: SelectUnlockedMedalsInput): readonly MedalUnlockCandidate[] {
  const alreadyUnlocked = new Set(input.alreadyUnlockedKeys);
  const now = input.now ?? new Date();

  return SHIPPED_MEDALS.filter(
    (medal) =>
      !alreadyUnlocked.has(medal.medalKey) &&
      !isWindowClosed(medal, now) &&
      input.satisfiedConditions.has(medal.condition),
  ).map((medal) => ({
    medalKey: medal.medalKey,
    series: medal.series,
    rarity: medal.rarity,
    numbered: medal.numbered,
  }));
}

/**
 * The conditions worth resolving for this collector: the ones behind a shipped medal they do not
 * hold yet, plus the ones behind a stateful medal they do (whose currency has to be recomputed
 * every time, since that is the whole point of marking it stateful).
 *
 * Narrowing the set is what keeps the evaluator cheap as a collector's album fills: a collector
 * holding every medal costs one query for the single stateful condition left, not eleven.
 */
export function resolveConditionsToEvaluate(alreadyUnlockedKeys: readonly string[]): ReadonlySet<MedalCondition> {
  const alreadyUnlocked = new Set(alreadyUnlockedKeys);
  const conditions = new Set<MedalCondition>();

  for (const medal of SHIPPED_MEDALS) {
    if (!alreadyUnlocked.has(medal.medalKey) || medal.stateful) {
      conditions.add(medal.condition);
    }
  }

  return conditions;
}

/** The shipped, stateful medals this collector holds, whose currency the album has to report. */
export function listStatefulUnlockedMedals(alreadyUnlockedKeys: readonly string[]): readonly MedalDefinition[] {
  const alreadyUnlocked = new Set(alreadyUnlockedKeys);
  return SHIPPED_MEDALS.filter((medal) => medal.stateful && alreadyUnlocked.has(medal.medalKey));
}

/** The catalogue grouped into album pages, in series order, phase-2 silhouettes included. */
export function listMedalsBySeries(): ReadonlyArray<{ series: MedalSeries; medals: readonly MedalDefinition[] }> {
  return MEDAL_SERIES_ORDER.map((series) => ({
    series,
    medals: MEDAL_CATALOGUE.filter((medal) => medal.series === series),
  }));
}
