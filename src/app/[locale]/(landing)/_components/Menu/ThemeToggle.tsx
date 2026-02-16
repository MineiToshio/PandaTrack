"use client";

import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import IconButton from "@/components/core/IconButton";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/styles";

type ThemeToggleProps = {
  className?: string;
};

export default function ThemeToggle({ className }: ThemeToggleProps) {
  const t = useTranslations("common.themeToggle");
  const { theme, toggleTheme } = useTheme();

  const isDark = theme === "dark";
  const ariaLabel = isDark ? t("switchToLight") : t("switchToDark");

  return (
    <IconButton
      Icon={isDark ? Sun : Moon}
      variant="outline"
      className={cn(className)}
      aria-label={ariaLabel}
      onClick={toggleTheme}
    />
  );
}
