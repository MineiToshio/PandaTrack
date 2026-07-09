import { BUDGET_MINOR_UNITS_PER_MAJOR } from "@/lib/user-settings/budgetConstants";

/**
 * Conversion boundary between the budget input (whole currency units, e.g. `200`) and the
 * persisted `User.budgetAmount` (minor units, e.g. `20000`). Every read and write of the budget
 * field in the settings UI must go through these two helpers so the units never drift again.
 *
 * Bounds are not checked here — `collectorPreferencesValidation` owns them, and the pane reverts
 * to the last committed value when the server rejects a save.
 */

const WHOLE_UNITS_PATTERN = /^\d+$/;

export type ParsedBudgetInput = { ok: true; minorUnits: number | null } | { ok: false };

/** Renders a persisted minor-unit budget as the whole-unit string shown in the input. */
export function toBudgetInputValue(minorUnits: number | null): string {
  if (minorUnits === null) {
    return "";
  }
  return String(minorUnits / BUDGET_MINOR_UNITS_PER_MAJOR);
}

/**
 * Parses what the collector typed into a persistable minor-unit budget. An empty input clears the
 * budget (`null`). Anything that is not a positive whole number is rejected, so the caller can
 * restore the previous value rather than persisting a silently coerced one.
 */
export function parseBudgetInputValue(raw: string): ParsedBudgetInput {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return { ok: true, minorUnits: null };
  }
  if (!WHOLE_UNITS_PATTERN.test(trimmed)) {
    return { ok: false };
  }
  const majorUnits = Number.parseInt(trimmed, 10);
  if (!Number.isSafeInteger(majorUnits) || majorUnits <= 0) {
    return { ok: false };
  }
  return { ok: true, minorUnits: majorUnits * BUDGET_MINOR_UNITS_PER_MAJOR };
}
