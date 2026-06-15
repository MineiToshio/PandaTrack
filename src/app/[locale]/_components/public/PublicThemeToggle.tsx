"use client";

import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "@/contexts/ThemeContext";

/**
 * Segmented light/dark theme control for public surfaces (`.mk-theme`).
 * Reuses the existing `data-theme` / `setTheme` mechanism (ADR 0003 D2 — no `system`).
 */
export default function PublicThemeToggle() {
  const t = useTranslations("common.themeToggle");
  const { theme, setTheme } = useTheme();

  const handleSetLight = () => setTheme("light");
  const handleSetDark = () => setTheme("dark");

  return (
    <div className="mk-theme" role="group" aria-label={t("label")}>
      <button type="button" aria-label={t("switchToLight")} aria-pressed={theme === "light"} onClick={handleSetLight}>
        <Sun aria-hidden="true" />
      </button>
      <button type="button" aria-label={t("switchToDark")} aria-pressed={theme === "dark"} onClick={handleSetDark}>
        <Moon aria-hidden="true" />
      </button>
    </div>
  );
}
