"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import SettingsNav, { type SettingsTab } from "./SettingsNav";

export type SettingsShellProps = {
  initialTab?: SettingsTab;
  profilePane: ReactNode;
  accountPane: ReactNode;
  preferencesPane: ReactNode;
};

const TAB_ORDER: readonly SettingsTab[] = ["profile", "account", "preferences"];

export default function SettingsShell({
  initialTab = "profile",
  profilePane,
  accountPane,
  preferencesPane,
}: SettingsShellProps) {
  const t = useTranslations("settings.tabs");
  const [active, setActive] = useState<SettingsTab>(initialTab);

  const labels = {
    profile: t("profile"),
    account: t("account"),
    preferences: t("preferences"),
    preferencesShort: t("preferencesShort"),
    ariaLabel: t("ariaLabel"),
  };

  const panes: Record<SettingsTab, ReactNode> = {
    profile: profilePane,
    account: accountPane,
    preferences: preferencesPane,
  };

  return (
    <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[220px_1fr] lg:gap-7">
      <SettingsNav value={active} onChange={setActive} labels={labels} />
      <div className="min-w-0">
        {TAB_ORDER.map((tab) => (
          <section
            key={tab}
            id={`settings-pane-${tab}`}
            role="tabpanel"
            aria-labelledby={`settings-tab-${tab}`}
            hidden={tab !== active}
            className="min-w-0 space-y-3.5"
          >
            {panes[tab]}
          </section>
        ))}
      </div>
    </div>
  );
}
