/**
 * The phase-1 progression rule catalogue.
 *
 * This module is deliberately the most dependency-light file in the domain: it imports NOTHING, not
 * Prisma, not the money helpers, not even a sibling type module. That is the whole point. A rule
 * decides how many points a recorded fact is worth, and it must never be able to look at what the
 * collector spent, because a reward that scales with money quietly turns into a nudge to buy.
 *
 * Money-derived conditions therefore arrive as plain booleans, resolved elsewhere: a rule declares
 * the CONDITION it needs (`"order-settled"`) and the recompute hands it a yes or no that
 * `moneyPredicateAdapter.ts` produced. No figure crosses into this file, in either direction.
 *
 * `src/test/progression-money-guard.test.ts` enforces that statically. Adding an import here, or
 * naming a monetary field, fails the build rather than a review.
 */

/** Catalogue key of a rule. Stored verbatim on every ledger entry. */
export const POINT_RULE_KEYS = {
  ORDER_CREATED: "order-created",
  ORDER_REGISTERED: "order-registered",
  ORDER_FIRST_PAYMENT: "order-first-payment",
  DELIVERY_RECEIVED: "delivery-received",
  ORDER_COMPLETED: "order-completed",
  ORDER_SETTLED: "order-settled",
  STORE_FIRST_ORDER: "store-first-order",
  PRODUCT_TYPE_DISCOVERED: "product-type-discovered",
  STORE_REVIEWED: "store-reviewed",
} as const;

export type PointRuleKey = (typeof POINT_RULE_KEYS)[keyof typeof POINT_RULE_KEYS];

/**
 * The kind of row a ledger entry's `entityId` names. It selects which batch resolver the recompute
 * runs; it is never treated as a validated reference, because `entityId` carries no foreign key.
 */
export const PROGRESSION_ENTITY_TYPES = {
  ORDER: "order",
  DELIVERY: "delivery",
  STORE: "store",
  PRODUCT_TYPE: "productType",
} as const;

export type ProgressionEntityType = (typeof PROGRESSION_ENTITY_TYPES)[keyof typeof PROGRESSION_ENTITY_TYPES];

/**
 * A condition the recompute must find satisfied for an entry to keep counting. Each one is resolved
 * in batch against current state and handed to the cap step as a boolean; none of them is stored on
 * the entry, which is what lets a cancelled order stop counting and a reactivated one resume with
 * no write of its own.
 */
export const POINT_RULE_CONDITIONS = {
  /** The row `entityId` names still exists and still belongs to this collector. */
  ENTITY_EXISTS: "entity-exists",
  /** The store is approved and public. Who registered it is not part of the gate (`BR-12-07`). */
  STORE_CREDIT_ELIGIBLE: "store-credit-eligible",
  /** The order has not been cancelled. Deliberately absent from `order-created`. */
  ORDER_NOT_CANCELLED: "order-not-cancelled",
  /** The order carries at least one assigned payment. Existence only, never an amount. */
  ORDER_HAS_ASSIGNED_PAYMENT: "order-has-assigned-payment",
  /** The order's derived status is `COMPLETED`. */
  ORDER_COMPLETED: "order-completed",
  /** The order is fully allocated. A boolean from the adapter, never the figure behind it. */
  ORDER_SETTLED: "order-settled",
  /** The delivery is currently in its delivered state: not reopened, not cancelled. */
  DELIVERY_DELIVERED: "delivery-delivered",
  /** At least one product of this type has reached `DELIVERED` on a credit-eligible order. */
  PRODUCT_TYPE_DELIVERED: "product-type-delivered",
  /** The collector still has a live order at this store. */
  STORE_HAS_ORDER: "store-has-order",
  /** The collector has actually received a product from this store. Existence only, never a count. */
  STORE_PRODUCT_RECEIVED: "store-product-received",
} as const;

export type PointRuleCondition = (typeof POINT_RULE_CONDITIONS)[keyof typeof POINT_RULE_CONDITIONS];

/**
 * How the collector-facing monthly breakdown groups the nine rules.
 *
 * A reader does not think in rule keys: "order-created" and "order-registered" are one line to them,
 * "you registered orders". The grouping lives on the rule rather than in the page so a tenth rule
 * has to declare where it is read, instead of silently falling out of the breakdown.
 */
export const POINT_RULE_GROUPS = {
  ORDERS: "orders",
  PAYMENTS: "payments",
  ARRIVALS: "arrivals",
  DISCOVERY: "discovery",
} as const;

export type PointRuleGroup = (typeof POINT_RULE_GROUPS)[keyof typeof POINT_RULE_GROUPS];

/** Group order for the breakdown: the order the collector's own flow produces them in. */
export const POINT_RULE_GROUP_ORDER: readonly PointRuleGroup[] = [
  POINT_RULE_GROUPS.ORDERS,
  POINT_RULE_GROUPS.PAYMENTS,
  POINT_RULE_GROUPS.ARRIVALS,
  POINT_RULE_GROUPS.DISCOVERY,
];

/** Unit a cap is expressed in. Stated explicitly on every rule: a bare number is ambiguous between
 *  a points ceiling and an event count, and that ambiguity has already produced one wrong reading. */
export type PointRuleCapUnit = "points" | "events";

/** Window a cap resets on. A `lifetime` cap is counted per entity, never per civil month. */
export type PointRuleCapWindow = "month" | "lifetime";

/**
 * When the rule is credited. `imm.` posts at the host mutation, `def.` posts once the order first
 * receives an assigned payment or its first arrival, and `der.` is never written by a mutation at
 * all: it is evaluated against current state.
 */
export type PointRuleTiming = "imm." | "def." | "der.";

/** Everything a point formula is allowed to see. Counters and positions only: no money. */
export type PointRuleContext = {
  /**
   * 1-based position of the order among this collector's orders at the SAME store within the same
   * civil month. Drives the anti-split ladder and nothing else.
   */
  storeMonthPosition: number;
};

export type PointRule = {
  ruleKey: PointRuleKey;
  entityType: ProgressionEntityType;
  /** Which line of the collector-facing monthly breakdown this rule is read on. */
  group: PointRuleGroup;
  points: number | ((context: PointRuleContext) => number);
  capUnit: PointRuleCapUnit;
  capValue: number;
  capWindow: PointRuleCapWindow;
  timing: PointRuleTiming;
  conditions: readonly PointRuleCondition[];
  /** Where the fact comes from, for the reader. Never parsed. */
  anchor: string;
};

/**
 * Anti-split ladder for `order-registered`: the first order of the month at a store is worth 20, the
 * second 15, the third 10, and the fourth and every later one the floor of 5.
 *
 * The floor is 5 rather than 0 on purpose. A collector who genuinely has five pre-orders open at one
 * store was being told the fifth was worth nothing, which punished the honest case in order to
 * discourage a split that the sublinear curve already makes unattractive.
 */
const ORDER_REGISTERED_LADDER = [20, 15, 10] as const;
const ORDER_REGISTERED_FLOOR = 5;

/** Exported so the write path can price an order before the ledger entry exists. */
export function orderRegisteredPoints(context: PointRuleContext): number {
  const position = Math.max(1, Math.trunc(context.storeMonthPosition));
  return ORDER_REGISTERED_LADDER[position - 1] ?? ORDER_REGISTERED_FLOOR;
}

const {
  ENTITY_EXISTS,
  STORE_CREDIT_ELIGIBLE,
  ORDER_NOT_CANCELLED,
  ORDER_HAS_ASSIGNED_PAYMENT,
  ORDER_COMPLETED,
  ORDER_SETTLED,
  DELIVERY_DELIVERED,
  PRODUCT_TYPE_DELIVERED,
  STORE_HAS_ORDER,
  STORE_PRODUCT_RECEIVED,
} = POINT_RULE_CONDITIONS;

/**
 * The nine rules this build knows, and no others. A fact that matches no rule here credits nothing,
 * which is
 * how the exhaustive zero-credit list is encoded: as absence, not as a list of exclusions somebody
 * has to remember to extend.
 */
export const POINT_RULES: readonly PointRule[] = Object.freeze([
  {
    ruleKey: POINT_RULE_KEYS.ORDER_CREATED,
    group: POINT_RULE_GROUPS.ORDERS,
    entityType: PROGRESSION_ENTITY_TYPES.ORDER,
    points: 5,
    capUnit: "events",
    capValue: 10,
    capWindow: "month",
    timing: "imm.",
    // Survives cancellation on purpose: cancelling is a real outcome the collector should not be
    // punished for recording. The event cap, not a reversal, is what bounds the create-cancel loop.
    // Physically deleting the order still drops it, through `entity-exists` like every other rule.
    conditions: [ENTITY_EXISTS, STORE_CREDIT_ELIGIBLE],
    anchor: "order creation",
  },
  {
    ruleKey: POINT_RULE_KEYS.ORDER_REGISTERED,
    group: POINT_RULE_GROUPS.ORDERS,
    entityType: PROGRESSION_ENTITY_TYPES.ORDER,
    points: orderRegisteredPoints,
    capUnit: "points",
    capValue: 120,
    capWindow: "month",
    timing: "def.",
    conditions: [ENTITY_EXISTS, STORE_CREDIT_ELIGIBLE, ORDER_NOT_CANCELLED, ORDER_HAS_ASSIGNED_PAYMENT],
    anchor: "order creation, credited at the first assigned payment or first arrival",
  },
  {
    ruleKey: POINT_RULE_KEYS.ORDER_FIRST_PAYMENT,
    group: POINT_RULE_GROUPS.PAYMENTS,
    entityType: PROGRESSION_ENTITY_TYPES.ORDER,
    points: 8,
    capUnit: "points",
    capValue: 80,
    capWindow: "month",
    timing: "def.",
    conditions: [ENTITY_EXISTS, STORE_CREDIT_ELIGIBLE, ORDER_NOT_CANCELLED, ORDER_HAS_ASSIGNED_PAYMENT],
    anchor: "the order's first assigned payment, once per order",
  },
  {
    ruleKey: POINT_RULE_KEYS.DELIVERY_RECEIVED,
    group: POINT_RULE_GROUPS.ARRIVALS,
    entityType: PROGRESSION_ENTITY_TYPES.DELIVERY,
    points: 25,
    capUnit: "points",
    capValue: 200,
    capWindow: "month",
    timing: "imm.",
    conditions: [ENTITY_EXISTS, STORE_CREDIT_ELIGIBLE, DELIVERY_DELIVERED, ORDER_HAS_ASSIGNED_PAYMENT],
    anchor: "a delivery reaching its delivered state",
  },
  {
    ruleKey: POINT_RULE_KEYS.ORDER_COMPLETED,
    group: POINT_RULE_GROUPS.ARRIVALS,
    entityType: PROGRESSION_ENTITY_TYPES.ORDER,
    points: 30,
    capUnit: "points",
    capValue: 240,
    capWindow: "month",
    timing: "der.",
    conditions: [
      ENTITY_EXISTS,
      STORE_CREDIT_ELIGIBLE,
      ORDER_NOT_CANCELLED,
      ORDER_HAS_ASSIGNED_PAYMENT,
      ORDER_COMPLETED,
    ],
    anchor: "the derived COMPLETED status, evaluated by the recompute",
  },
  {
    ruleKey: POINT_RULE_KEYS.ORDER_SETTLED,
    group: POINT_RULE_GROUPS.PAYMENTS,
    entityType: PROGRESSION_ENTITY_TYPES.ORDER,
    points: 12,
    capUnit: "points",
    capValue: 120,
    capWindow: "month",
    timing: "der.",
    conditions: [ENTITY_EXISTS, STORE_CREDIT_ELIGIBLE, ORDER_NOT_CANCELLED, ORDER_HAS_ASSIGNED_PAYMENT, ORDER_SETTLED],
    anchor: "the adapter's settled predicate, evaluated by the recompute",
  },
  {
    ruleKey: POINT_RULE_KEYS.STORE_FIRST_ORDER,
    group: POINT_RULE_GROUPS.DISCOVERY,
    entityType: PROGRESSION_ENTITY_TYPES.STORE,
    points: 20,
    capUnit: "points",
    capValue: 80,
    capWindow: "month",
    timing: "imm.",
    // Keyed by the store, so the idempotency triple already makes it once-per-store for good.
    conditions: [ENTITY_EXISTS, STORE_CREDIT_ELIGIBLE, STORE_HAS_ORDER],
    anchor: "the first order this collector ever placed at a given store",
  },
  {
    ruleKey: POINT_RULE_KEYS.PRODUCT_TYPE_DISCOVERED,
    group: POINT_RULE_GROUPS.DISCOVERY,
    entityType: PROGRESSION_ENTITY_TYPES.PRODUCT_TYPE,
    points: 12,
    // Counted per product type rather than per month: the seeded catalogue is the natural ceiling,
    // so this credits once for each type the collector ever receives and never resets.
    capUnit: "events",
    capValue: 1,
    capWindow: "lifetime",
    timing: "der.",
    conditions: [ENTITY_EXISTS, PRODUCT_TYPE_DELIVERED],
    anchor: "the first product of a type reaching DELIVERED, evaluated by the recompute",
  },
  {
    ruleKey: POINT_RULE_KEYS.STORE_REVIEWED,
    group: POINT_RULE_GROUPS.DISCOVERY,
    entityType: PROGRESSION_ENTITY_TYPES.STORE,
    points: 20,
    capUnit: "points",
    capValue: 60,
    capWindow: "month",
    timing: "imm.",
    // Keyed by the STORE, not the review row, so deleting a review and writing it again credits
    // exactly once (`AC-12-05`). The received-product condition is what stops a review of a place
    // the collector never bought from being worth anything.
    conditions: [ENTITY_EXISTS, STORE_CREDIT_ELIGIBLE, STORE_PRODUCT_RECEIVED],
    anchor: "a review written for a store this collector already received a product from",
  },
]);

const RULES_BY_KEY = new Map<string, PointRule>(POINT_RULES.map((rule) => [rule.ruleKey, rule]));

/** Returns the rule for a stored `ruleKey`, or `undefined` for a key no longer in the catalogue. */
export function findPointRule(ruleKey: string): PointRule | undefined {
  return RULES_BY_KEY.get(ruleKey);
}

/** True when the key names a rule this build knows how to evaluate. */
export function isKnownRuleKey(ruleKey: string): ruleKey is PointRuleKey {
  return RULES_BY_KEY.has(ruleKey);
}

/** Resolves a rule's point value for the write path. Derived rules and fixed rules both land here. */
export function resolveRulePoints(rule: PointRule, context: PointRuleContext): number {
  return typeof rule.points === "function" ? rule.points(context) : rule.points;
}
