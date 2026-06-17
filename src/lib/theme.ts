import type { Theme } from "@/types/theme";

const THEME_KEY = "pandatrack-theme";

function safeLocalStorage(op: () => void) {
  try {
    op();
  } catch {
    // localStorage may be unavailable (SSR, private mode, etc.)
  }
}

export function setTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
  safeLocalStorage(() => localStorage.setItem(THEME_KEY, theme));
}

export function getTheme(): Theme {
  if (typeof document === "undefined") return "light";
  const val = document.documentElement.dataset.theme;
  return val === "light" || val === "dark" ? val : "light";
}
