"use client";

import posthog from "posthog-js";
import DateRangePickerInput, { type DateRangePreset } from "@/components/core/DateRangePickerInput";
import { POSTHOG_EVENTS } from "@/lib/constants";
import { utcDomainDateToLocal } from "@/lib/domainDate";
import { toIsoDateString } from "@/lib/localDate";
import { cn } from "@/lib/styles";
import type { DashboardRangePreset } from "@/lib/data/dashboard/dashboardTypes";
import { DASHBOARD_DEFAULT_RANGE_PRESET, buildDashboardRangeQuery } from "../_utils/dashboardRangeParams";
import { useTrendsRangeTransition } from "./DashboardTrendsRangeProvider";

export type DashboardRangeControlProps = {
  presets: DateRangePreset[];
  /** Label of the active selection, shown on the trigger when no custom range is set. */
  activeLabel: string;
  /** Custom range endpoints as UTC-midnight domain dates, or null when a preset is active. */
  customFrom: Date | null;
  customTo: Date | null;
  clearLabel: string;
  locale: string;
  disabled?: boolean;
};

const RANGE_CONTROL_ID = "dashboard-range-control";

/**
 * The single shared control for the trend charts. It writes the selection to the URL so
 * the page re-renders on the server with a new range; the fixed current-period metrics are computed
 * from `now` and are therefore unaffected by it.
 */
export default function DashboardRangeControl({
  presets,
  activeLabel,
  customFrom,
  customTo,
  clearLabel,
  locale,
  disabled = false,
}: DashboardRangeControlProps) {
  // The transition is owned by the provider so the chart surface can show its loading state from
  // the same flag; this control only reports it on itself.
  const { isPending, navigate: pushRange } = useTrendsRangeTransition();

  const handlePresetSelect = (value: string) => {
    posthog.capture(POSTHOG_EVENTS.DASHBOARD.RANGE_PRESET_SELECTED, { preset: value });
    // The rail is rendered from `DASHBOARD_RANGE_PRESETS`, so the value is always a known preset.
    pushRange(buildDashboardRangeQuery(value as DashboardRangePreset));
  };

  const handleChange = (from: Date | null, to: Date | null) => {
    if (!from && !to) {
      pushRange(buildDashboardRangeQuery(DASHBOARD_DEFAULT_RANGE_PRESET));
      return;
    }
    if (!from || !to) {
      // The collector has picked only the start day; wait for the closing day.
      return;
    }
    const fromDay = toIsoDateString(from);
    const toDay = toIsoDateString(to);
    posthog.capture(POSTHOG_EVENTS.DASHBOARD.RANGE_CUSTOM_APPLIED, { from: fromDay, to: toDay });
    pushRange(buildDashboardRangeQuery("custom", fromDay, toDay));
  };

  return (
    <div className={cn("shrink-0", isPending && "opacity-70")} aria-busy={isPending || undefined}>
      <DateRangePickerInput
        id={RANGE_CONTROL_ID}
        size="sm"
        locale={locale}
        // The picker works in local time; domain dates are stored at UTC midnight.
        from={customFrom ? utcDomainDateToLocal(customFrom) : null}
        to={customTo ? utcDomainDateToLocal(customTo) : null}
        onChange={handleChange}
        placeholder={activeLabel}
        clearLabel={clearLabel}
        presets={presets}
        onPresetSelect={handlePresetSelect}
        disabled={disabled}
      />
    </div>
  );
}
