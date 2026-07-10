import { z } from "zod";
import type { DashboardRangePreset, DashboardRangeSelection } from "@/lib/data/dashboard/dashboardTypes";

export const DASHBOARD_RANGE_PARAM = "range";
export const DASHBOARD_RANGE_FROM_PARAM = "from";
export const DASHBOARD_RANGE_TO_PARAM = "to";

/** The window the dashboard opens with when the URL carries no range. */
export const DASHBOARD_DEFAULT_RANGE_PRESET: DashboardRangePreset = "6m";

/** Accepted values of the `range` search param. Kept in sync with `DASHBOARD_RANGE_PRESETS`. */
const RANGE_PARAM_VALUES = ["3m", "6m", "12m", "ytd", "all", "custom"] as const;

const rangeParamSchema = z.enum(RANGE_PARAM_VALUES);
const isoDaySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export type DashboardSearchParams = Record<string, string | string[] | undefined>;

function readParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Parses a `YYYY-MM-DD` day into the UTC-midnight instant the domain uses for calendar days. */
function parseIsoDay(value: string): Date | null {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Resolves the trend-chart range from the URL. Search params are untrusted input, so anything
 * unrecognized quietly falls back to the default window rather than failing the page render.
 */
export function parseDashboardRangeSelection(params: DashboardSearchParams): DashboardRangeSelection {
  const preset = rangeParamSchema.safeParse(readParam(params[DASHBOARD_RANGE_PARAM]));
  if (!preset.success) {
    return { preset: DASHBOARD_DEFAULT_RANGE_PRESET };
  }
  if (preset.data !== "custom") {
    return { preset: preset.data };
  }

  const from = isoDaySchema.safeParse(readParam(params[DASHBOARD_RANGE_FROM_PARAM]));
  const to = isoDaySchema.safeParse(readParam(params[DASHBOARD_RANGE_TO_PARAM]));
  if (!from.success || !to.success) {
    return { preset: DASHBOARD_DEFAULT_RANGE_PRESET };
  }

  const fromDate = parseIsoDay(from.data);
  const toDate = parseIsoDay(to.data);
  if (!fromDate || !toDate) {
    return { preset: DASHBOARD_DEFAULT_RANGE_PRESET };
  }

  return { preset: "custom", from: fromDate, to: toDate };
}

/** Builds the query string the range control pushes. Custom ranges carry their day endpoints. */
export function buildDashboardRangeQuery(preset: DashboardRangePreset | "custom", from?: string, to?: string): string {
  const params = new URLSearchParams({ [DASHBOARD_RANGE_PARAM]: preset });
  if (preset === "custom" && from && to) {
    params.set(DASHBOARD_RANGE_FROM_PARAM, from);
    params.set(DASHBOARD_RANGE_TO_PARAM, to);
  }
  return `?${params.toString()}`;
}
