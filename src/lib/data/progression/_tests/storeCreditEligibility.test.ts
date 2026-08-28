import { describe, expect, it } from "vitest";
import { StoreStatus, StoreVisibility } from "../../../../../generated/prisma/client";
import {
  CREDITABLE_STORE_FILTER,
  isStoreCreditEligible,
  STORE_CREDIT_ELIGIBILITY_SELECT,
  type StoreEligibilityRow,
} from "../storeCreditEligibility";

/**
 * `BR-12-07` in isolation, because it is the one predicate the whole progression hangs from: it runs
 * on every write path and again on every recompute, and the two answering differently is the failure
 * this module exists to prevent.
 *
 * The rule was relaxed on 2026-08-23. It used to disqualify a store the collector had registered
 * themselves, which in PandaTrack punished the ordinary flow (the collector registers the shop they
 * buy from) and, after the Notion import attributed all 140 stores to the owner, zeroed out
 * everything. Approval is the lock now: an invented store still credits nothing until a moderator
 * approves it, which is the one step the collector cannot take alone.
 */

const APPROVED_PUBLIC: StoreEligibilityRow = {
  status: StoreStatus.APPROVED,
  visibility: StoreVisibility.PUBLIC,
  isPrivate: false,
};

describe("isStoreCreditEligible", () => {
  it("credits an approved, public store", () => {
    expect(isStoreCreditEligible(APPROVED_PUBLIC)).toBe(true);
  });

  it.each([
    ["still pending approval", { status: StoreStatus.PENDING }],
    ["rejected by a moderator", { status: StoreStatus.REJECTED }],
    ["flagged private", { isPrivate: true }],
    ["hidden from the public directory", { visibility: StoreVisibility.PRIVATE }],
  ])("refuses a store that is %s", (_label, override) => {
    expect(isStoreCreditEligible({ ...APPROVED_PUBLIC, ...override })).toBe(false);
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
  ])("refuses %s rather than assuming a missing row is fine", (_label, store) => {
    expect(isStoreCreditEligible(store)).toBe(false);
  });

  /**
   * Structural, not behavioural: the gate cannot depend on who registered the store if it never asks
   * for the column. Reinstating the old creator clause would have to reinstate the field first, and
   * this fails the moment it does.
   */
  it("never asks the database who registered the store", () => {
    expect(Object.keys(STORE_CREDIT_ELIGIBILITY_SELECT)).toEqual(["status", "visibility", "isPrivate"]);
    expect(Object.keys(CREDITABLE_STORE_FILTER)).toEqual(["status", "visibility", "isPrivate"]);
  });

  /** The row-shaped gate and the query-shaped one have to describe the same store. */
  it("keeps the Prisma filter and the predicate in agreement", () => {
    expect(isStoreCreditEligible(CREDITABLE_STORE_FILTER)).toBe(true);
  });
});
