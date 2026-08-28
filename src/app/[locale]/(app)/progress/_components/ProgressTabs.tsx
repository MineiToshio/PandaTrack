"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import posthog from "posthog-js";
import Tabs from "@/components/modules/Tabs/Tabs";
import { POSTHOG_EVENTS } from "@/lib/constants";
import {
  PROGRESS_PANEL_ID,
  PROGRESS_TABS,
  buildProgressTabHref,
  resolveProgressTab,
  type ProgressTab,
} from "../_utils/progressTabs";

type ProgressTabsProps = {
  locale: string;
  ariaLabel: string;
  /** Translated label per tab, resolved by the server so this island carries no message catalogue. */
  labels: Record<ProgressTab, string>;
};

/**
 * The section's three-tab subnav.
 *
 * A client island only because the active tab is read from the current pathname and because the
 * selection is what the analytics report; the panels themselves stay server-rendered. Each tab is a
 * real link, so the section survives a middle click and a bookmark the way the rest of the app's
 * navigation does.
 */
export default function ProgressTabs({ locale, ariaLabel, labels }: ProgressTabsProps) {
  const pathname = usePathname() ?? "";
  const activeTab = resolveProgressTab(pathname);
  // The tab the collector came FROM, so a change reports both ends of the move rather than only
  // where they landed. A ref, not state: it must not cause a render of its own.
  const previousTabRef = useRef<ProgressTab>(activeTab);

  useEffect(() => {
    posthog.capture(POSTHOG_EVENTS.PROGRESSION.PROGRESS_VIEWED, { active_tab: activeTab });
    previousTabRef.current = activeTab;
  }, [activeTab]);

  const handleSelect = (value: string) => {
    if (value === activeTab) return;
    posthog.capture(POSTHOG_EVENTS.PROGRESSION.PROGRESS_TAB_CHANGED, {
      from_tab: previousTabRef.current,
      to_tab: value,
    });
  };

  return (
    <Tabs
      variant="underline"
      ariaLabel={ariaLabel}
      panelId={PROGRESS_PANEL_ID}
      value={activeTab}
      onChange={handleSelect}
      items={PROGRESS_TABS.map((tab) => ({
        value: tab,
        label: labels[tab],
        href: buildProgressTabHref(locale, tab),
      }))}
    />
  );
}
