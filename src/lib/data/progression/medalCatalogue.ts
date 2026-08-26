/**
 * The medal catalogue: twenty-eight pieces across six series, and the pure rules over them.
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
  /** Orders at two DISTINCT creditable stores. Deliberately not "one order", which is `ANY_ORDER`. */
  STORES_ORDERED_2: "stores-ordered-2",
  /** One order at a creditable store carries an assigned payment. Existence only, never an amount. */
  ANY_PAYMENT: "any-payment",
  /** One order carries an expected arrival window: the collector recorded a pre-order as a pre-order. */
  PREORDER_WINDOW_RECORDED: "preorder-window-recorded",
  /** One delivery from a creditable store has reached its delivered state. */
  ANY_ARRIVAL: "any-arrival",
  /** One order is both fully covered and fully arrived. The money half is a boolean from the adapter. */
  ORDER_FULLY_CLOSED: "order-fully-closed",
  /** A review exists for a creditable store the collector already received a product from. */
  REVIEW_AFTER_ARRIVAL: "review-after-arrival",
  /** Five such reviews. `StoreReview` is unique per store and collector, so five reviews are five stores. */
  REVIEWS_5: "reviews-5",
  /** The order this very request created carries the image-intake marker. Call-time only. */
  ORDER_FROM_IMAGE: "order-from-image",
  /** An order fully arrived 60 / 120 / 200 or more days after the day it was placed. */
  WAIT_60_DAYS: "wait-60-days",
  WAIT_120_DAYS: "wait-120-days",
  WAIT_200_DAYS: "wait-200-days",
  /** An order fully arrived within a week of the day it was placed. The mirror of the patience set. */
  SWIFT_ARRIVAL_7: "swift-arrival-7",
  /** One order whose products arrived across more than one delivery. */
  SPLIT_ARRIVAL: "split-arrival",
  /** An order created between 00:00 and 04:00 of the collector's own civil day. */
  MIDNIGHT_ORDER: "midnight-order",
  /** Delivered product LINES, not units: what "ten pieces" means to somebody looking at a shelf. */
  PRODUCTS_DELIVERED_10: "products-delivered-10",
  PRODUCTS_DELIVERED_50: "products-delivered-50",
  PRODUCTS_DELIVERED_150: "products-delivered-150",
  /** Deliveries received. */
  ARRIVALS_25: "arrivals-25",
  /** Distinct product types delivered. */
  PRODUCT_TYPES_3: "product-types-3",
  PRODUCT_TYPES_6: "product-types-6",
  /** Distinct stores with at least one delivery. */
  STORES_WITH_ARRIVAL_10: "stores-with-arrival-10",
  /** Distinct countries of the stores something actually arrived from. */
  COUNTRIES_3: "countries-3",
  /** Orders whose every product field is filled in. */
  COMPLETE_RECORD_1: "complete-record-1",
  COMPLETE_RECORD_10: "complete-record-10",
  /**
   * A store this collector registered survived moderation.
   *
   * Replaces the phase-2 `store-adopted`, which additionally waited on a STRANGER ordering from that
   * store: the only condition in the catalogue nothing the collector did could bring about.
   */
  STORE_APPROVED_1: "store-approved-1",
  /** Secret: an order paid off and closed on the day it arrived. */
  SAME_DAY_SETTLE: "same-day-settle",
  /** Secret: twelve consecutive civil months with at least one order. */
  YEAR_STREAK: "year-streak",
} as const;

export type MedalCondition = (typeof MEDAL_CONDITIONS)[keyof typeof MEDAL_CONDITIONS];

/**
 * Which build a medal is awardable in.
 *
 * Every one of the twenty-eight rows is phase 1: the twelve pieces that used to be catalogued but
 * not shipped were never blocked by the data model, only by an ordering decision about evaluation
 * cost, so the album no longer renders a single "próximamente" tile (`FR-12-20`).
 *
 * The grade survives the promotion because a phase-2 entry is still the shape a time-limited event
 * medal arrives in (`FR-12-28`): catalogued, rendered as a promise, excluded from every counter and
 * from the evaluator. Removing it would mean rebuilding that path the first time an event is
 * authored, and the album's own copy for it already exists.
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
  STORES_ORDERED_2,
  ANY_PAYMENT,
  PREORDER_WINDOW_RECORDED,
  ANY_ARRIVAL,
  ORDER_FULLY_CLOSED,
  REVIEW_AFTER_ARRIVAL,
  REVIEWS_5,
  ORDER_FROM_IMAGE,
  WAIT_60_DAYS,
  WAIT_120_DAYS,
  WAIT_200_DAYS,
  SWIFT_ARRIVAL_7,
  SPLIT_ARRIVAL,
  MIDNIGHT_ORDER,
  PRODUCTS_DELIVERED_10,
  PRODUCTS_DELIVERED_50,
  PRODUCTS_DELIVERED_150,
  ARRIVALS_25,
  PRODUCT_TYPES_3,
  PRODUCT_TYPES_6,
  STORES_WITH_ARRIVAL_10,
  COUNTRIES_3,
  COMPLETE_RECORD_1,
  COMPLETE_RECORD_10,
  STORE_APPROVED_1,
  SAME_DAY_SETTLE,
  YEAR_STREAK,
} = MEDAL_CONDITIONS;

const { NORMAL, FIRST_PRINT, LIMITED, HOLO, SIGNED } = MEDAL_RARITIES;

/** Defaults every entry shares (phase-3 event columns of `FR-12-28`, and the art hole). */
const MEDAL_DEFAULTS = { availableFrom: null, availableTo: null, numbered: false, imageKey: null } as const;

/**
 * The twenty-eight medals, in album order.
 *
 * Every row ships. The catalogue is laid out so each of the six album pages fills its grid rows
 * (`first-steps` carries eight, every other page four), and so the rarity spread reads like a real
 * print run rather than a difficulty curve: ten `normal`, seven `first-print`, five `limited`, five
 * `holo` and a single `signed`. `first-steps` stays almost entirely `normal` on purpose, because
 * page one is where a collector learns what the baseline looks like.
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
    imageKey: "first-order",
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
    imageKey: "first-payment",
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
    imageKey: "first-arrival",
  },
  {
    medalKey: "first-order-closed",
    series: MEDAL_SERIES.FIRST_STEPS,
    // The one piece of page one that asks for both halves of the app at once, so it is the one
    // piece of page one that is not `normal`.
    rarity: FIRST_PRINT,
    condition: ORDER_FULLY_CLOSED,
    phase: 1,
    publicSafe: true,
    // Reopening a delivery puts a product back in transit and the circle is no longer closed. The
    // unlock stays; only the currency line changes (`AC-12-12`).
    stateful: true,
    secret: false,
    controllable: true,
    ...MEDAL_DEFAULTS,
    imageKey: "first-order-closed",
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
    imageKey: "first-review",
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
    imageKey: "first-photo-order",
  },
  {
    medalKey: "first-store",
    series: MEDAL_SERIES.FIRST_STEPS,
    rarity: NORMAL,
    // A SECOND distinct store, not the first one. Reading `ANY_ORDER` here (which a collector's very
    // first order satisfies by definition, since that store is new to them) meant one click handed
    // out two medals in the same instant, and the second one read as padding.
    condition: STORES_ORDERED_2,
    phase: 1,
    publicSafe: true,
    stateful: false,
    secret: false,
    controllable: true,
    ...MEDAL_DEFAULTS,
    imageKey: "first-store",
  },
  {
    medalKey: "first-preorder",
    series: MEDAL_SERIES.FIRST_STEPS,
    rarity: NORMAL,
    condition: PREORDER_WINDOW_RECORDED,
    phase: 1,
    publicSafe: true,
    stateful: false,
    secret: false,
    controllable: true,
    ...MEDAL_DEFAULTS,
    imageKey: "first-preorder",
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
    imageKey: "patience-60",
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
    imageKey: "patience-120",
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
    imageKey: "patience-200",
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
    imageKey: "split-arrival",
  },

  // --- La vitrina -----------------------------------------------------------------------------
  {
    medalKey: "collection-10",
    series: MEDAL_SERIES.THE_DISPLAY_CASE,
    rarity: NORMAL,
    condition: PRODUCTS_DELIVERED_10,
    phase: 1,
    publicSafe: false,
    stateful: true,
    secret: false,
    controllable: true,
    ...MEDAL_DEFAULTS,
    imageKey: "collection-10",
  },
  {
    medalKey: "collection-50",
    series: MEDAL_SERIES.THE_DISPLAY_CASE,
    rarity: FIRST_PRINT,
    condition: PRODUCTS_DELIVERED_50,
    phase: 1,
    publicSafe: false,
    stateful: true,
    secret: false,
    controllable: true,
    ...MEDAL_DEFAULTS,
    imageKey: "collection-50",
  },
  {
    medalKey: "collection-150",
    series: MEDAL_SERIES.THE_DISPLAY_CASE,
    rarity: HOLO,
    condition: PRODUCTS_DELIVERED_150,
    phase: 1,
    publicSafe: false,
    stateful: true,
    secret: false,
    controllable: true,
    ...MEDAL_DEFAULTS,
    imageKey: "collection-150",
  },
  {
    medalKey: "arrivals-25",
    series: MEDAL_SERIES.THE_DISPLAY_CASE,
    rarity: LIMITED,
    condition: ARRIVALS_25,
    phase: 1,
    publicSafe: false,
    stateful: true,
    secret: false,
    controllable: true,
    ...MEDAL_DEFAULTS,
    imageKey: "arrivals-25",
  },

  // --- Explorador -----------------------------------------------------------------------------
  {
    medalKey: "variety-3",
    series: MEDAL_SERIES.EXPLORER,
    rarity: NORMAL,
    condition: PRODUCT_TYPES_3,
    phase: 1,
    publicSafe: false,
    stateful: true,
    secret: false,
    controllable: true,
    ...MEDAL_DEFAULTS,
    imageKey: "variety-3",
  },
  {
    medalKey: "countries-3",
    series: MEDAL_SERIES.EXPLORER,
    rarity: FIRST_PRINT,
    condition: COUNTRIES_3,
    phase: 1,
    // Names which parts of the world a collector imports from, which is the same class of fact as
    // the store count beside it.
    publicSafe: false,
    stateful: true,
    secret: false,
    controllable: true,
    ...MEDAL_DEFAULTS,
    imageKey: "countries-3",
  },
  {
    medalKey: "variety-6",
    series: MEDAL_SERIES.EXPLORER,
    rarity: LIMITED,
    condition: PRODUCT_TYPES_6,
    phase: 1,
    publicSafe: false,
    stateful: true,
    secret: false,
    controllable: true,
    ...MEDAL_DEFAULTS,
    imageKey: "variety-6",
  },
  {
    medalKey: "stores-10",
    series: MEDAL_SERIES.EXPLORER,
    rarity: HOLO,
    condition: STORES_WITH_ARRIVAL_10,
    phase: 1,
    publicSafe: false,
    stateful: true,
    secret: false,
    controllable: true,
    ...MEDAL_DEFAULTS,
    imageKey: "stores-10",
  },

  // --- Cronista -------------------------------------------------------------------------------
  {
    medalKey: "clean-record-1",
    series: MEDAL_SERIES.CHRONICLER,
    rarity: NORMAL,
    condition: COMPLETE_RECORD_1,
    phase: 1,
    publicSafe: true,
    stateful: true,
    secret: false,
    controllable: true,
    ...MEDAL_DEFAULTS,
    imageKey: "clean-record-1",
  },
  {
    medalKey: "store-charted-1",
    series: MEDAL_SERIES.CHRONICLER,
    rarity: FIRST_PRINT,
    condition: STORE_APPROVED_1,
    phase: 1,
    publicSafe: true,
    // Approval is granted once and the medal records that it happened. A store later removed from
    // the map does not un-happen the contribution (`BR-12-08`).
    stateful: false,
    secret: false,
    // The whole point of the replacement: the finish line moved to the part the collector controls.
    controllable: true,
    ...MEDAL_DEFAULTS,
    imageKey: "store-charted-1",
  },
  {
    medalKey: "reviews-5",
    series: MEDAL_SERIES.CHRONICLER,
    rarity: LIMITED,
    condition: REVIEWS_5,
    phase: 1,
    publicSafe: true,
    // Reviews can be deleted, exactly as `first-review`'s can.
    stateful: true,
    secret: false,
    controllable: true,
    ...MEDAL_DEFAULTS,
    imageKey: "reviews-5",
  },
  {
    medalKey: "clean-record-10",
    series: MEDAL_SERIES.CHRONICLER,
    rarity: HOLO,
    condition: COMPLETE_RECORD_10,
    phase: 1,
    publicSafe: true,
    stateful: true,
    secret: false,
    controllable: true,
    ...MEDAL_DEFAULTS,
    imageKey: "clean-record-10",
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
    imageKey: "midnight-order",
  },
  {
    medalKey: "swift-arrival",
    series: MEDAL_SERIES.SECRETS,
    rarity: LIMITED,
    condition: SWIFT_ARRIVAL_7,
    phase: 1,
    publicSafe: true,
    stateful: false,
    secret: true,
    controllable: true,
    ...MEDAL_DEFAULTS,
    imageKey: "swift-arrival",
  },
  {
    medalKey: "same-day-settle",
    series: MEDAL_SERIES.SECRETS,
    rarity: HOLO,
    condition: SAME_DAY_SETTLE,
    phase: 1,
    publicSafe: true,
    stateful: false,
    secret: true,
    controllable: true,
    ...MEDAL_DEFAULTS,
    imageKey: "same-day-settle",
  },
  {
    medalKey: "year-streak",
    series: MEDAL_SERIES.SECRETS,
    rarity: SIGNED,
    condition: YEAR_STREAK,
    phase: 1,
    publicSafe: true,
    stateful: false,
    secret: true,
    controllable: true,
    ...MEDAL_DEFAULTS,
    imageKey: "year-streak",
  },
]);

const MEDALS_BY_KEY = new Map<string, MedalDefinition>(MEDAL_CATALOGUE.map((medal) => [medal.medalKey, medal]));

/** The medal for a stored key, or `undefined` for a key this build no longer knows. */
export function findMedal(medalKey: string): MedalDefinition | undefined {
  return MEDALS_BY_KEY.get(medalKey);
}

/** Whether a medal can actually be awarded by this build. Every row of the catalogue currently is. */
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

/** Whether an event window is closed as of `now`. No medal in the catalogue carries one yet. */
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
 * holding every medal costs one query per surviving stateful condition, not one per catalogue row.
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

/** The catalogue grouped into album pages, in series order. */
export function listMedalsBySeries(): ReadonlyArray<{ series: MedalSeries; medals: readonly MedalDefinition[] }> {
  return MEDAL_SERIES_ORDER.map((series) => ({
    series,
    medals: MEDAL_CATALOGUE.filter((medal) => medal.series === series),
  }));
}
