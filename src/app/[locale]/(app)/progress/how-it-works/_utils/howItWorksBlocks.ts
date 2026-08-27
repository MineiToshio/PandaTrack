import { Gauge, ListChecks, Medal, RefreshCcw, Store, Wallet, type LucideIcon } from "lucide-react";

/**
 * The six rules the explainer publishes, in reading order.
 *
 * The list is a constant rather than something the page inlines because it is the contract the copy
 * guard checks: every key here must have a `title`, a `body` and a `why` in both locales, and no
 * string under `progress.howItWorks` may carry a figure. Adding a seventh block therefore has to
 * bring its own copy in both languages, in the shape the surface reads.
 *
 * The order is the order a collector meets the rules in: what earns points, why an order's points
 * wait, what bounds them, what takes them away, what a store has to be, and what is permanent.
 * `mature` is second on purpose. It is the only rule that looks like a bug when it is not explained,
 * and it was reported as one during development.
 */
export const HOW_IT_WORKS_BLOCK_KEYS = ["earn", "mature", "caps", "recompute", "stores", "permanence"] as const;

export type HowItWorksBlockKey = (typeof HOW_IT_WORKS_BLOCK_KEYS)[number];

/** One glyph per rule, so the six blocks can be told apart at a glance on a page of plain prose. */
export const HOW_IT_WORKS_BLOCK_ICONS: Readonly<Record<HowItWorksBlockKey, LucideIcon>> = {
  earn: ListChecks,
  mature: Wallet,
  caps: Gauge,
  recompute: RefreshCcw,
  stores: Store,
  permanence: Medal,
};
