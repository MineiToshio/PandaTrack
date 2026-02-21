"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { THEME_STORAGE_KEY } from "@/lib/constants";

export type Theme = "light" | "dark";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getEffectiveTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  if (typeof localStorage !== "undefined") {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === "light" || stored === "dark") return stored;
    } catch {
      // Ignore storage errors
    }
  }
  const dataTheme = document.documentElement.getAttribute("data-theme");
  if (dataTheme === "light" || dataTheme === "dark") return dataTheme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function hasStoredTheme(): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark";
  } catch {
    return false;
  }
}

function applyTheme(next: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", next);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    // Ignore storage errors (e.g. private mode)
  }
}

type ThemeProviderProps = {
  children: ReactNode;
};

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    const applyEffectiveTheme = () => {
      const next = getEffectiveTheme();
      applyTheme(next);
      setThemeState(next);
    };

    applyEffectiveTheme();

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if (!hasStoredTheme()) applyEffectiveTheme();
    };
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    applyTheme(next);
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
  }, [theme, setTheme]);

  const value: ThemeContextValue = { theme, setTheme, toggleTheme };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
