"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import posthog from "posthog-js";
import { useTheme } from "@/contexts/ThemeContext";
import { POSTHOG_EVENTS, ROUTES } from "@/lib/constants";

export const MASCOT_VISIBLE_KEY = "pandatrack-mascot-visible";
export const MASCOT_HIDDEN_VALUE = "hidden";

const LONG_PRESS_MS = 500;
const LONG_PRESS_MOVE_THRESHOLD_PX = 8;

type MascotBubbleProps = {
  locale: string;
  visible?: boolean;
  onHide?: () => void;
};

export default function MascotBubble({ locale, visible = true, onHide }: MascotBubbleProps) {
  const t = useTranslations("components.mascotBubble");
  const { toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const bubbleRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressStartPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && !bubbleRef.current?.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        bubbleRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  if (!visible) return null;

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setMenuOpen((prev) => !prev);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    longPressStartPos.current = { x: e.clientX, y: e.clientY };
    longPressTimerRef.current = setTimeout(() => {
      setMenuOpen(true);
    }, LONG_PRESS_MS);
  };

  const cancelLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressStartPos.current = null;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!longPressStartPos.current) return;
    const dx = Math.abs(e.clientX - longPressStartPos.current.x);
    const dy = Math.abs(e.clientY - longPressStartPos.current.y);
    if (dx > LONG_PRESS_MOVE_THRESHOLD_PX || dy > LONG_PRESS_MOVE_THRESHOLD_PX) {
      cancelLongPress();
    }
  };

  const handleHide = () => {
    try {
      localStorage.setItem(MASCOT_VISIBLE_KEY, MASCOT_HIDDEN_VALUE);
    } catch {
      // Ignore storage errors (private mode, quota exceeded)
    }
    posthog.capture(POSTHOG_EVENTS.APP_SHELL.MASCOT_HIDDEN);
    setMenuOpen(false);
    onHide?.();
  };

  const handleChangeTheme = () => {
    toggleTheme();
    posthog.capture(POSTHOG_EVENTS.APP_SHELL.THEME_CHANGED, { source: "mascot_context_menu" });
    setMenuOpen(false);
  };

  return (
    <div className="fixed right-6 bottom-6 z-[35]">
      <button
        ref={bubbleRef}
        type="button"
        aria-label={t("contextMenu.open")}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        className="border-border focus-visible:ring-focus-ring relative flex h-14 w-14 cursor-pointer items-center justify-center rounded-full border transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        style={{
          background: "color-mix(in oklch, var(--accent-cool) 16%, var(--surface))",
          boxShadow: "var(--elevation-3)",
        }}
        onContextMenu={handleContextMenu}
        onPointerDown={handlePointerDown}
        onPointerUp={cancelLongPress}
        onPointerLeave={cancelLongPress}
        onPointerMove={handlePointerMove}
        onClick={() => setMenuOpen((prev) => !prev)}
      >
        <Image src="/icon.svg" alt="" width={40} height={40} className="h-10 w-10 object-contain" aria-hidden />
      </button>

      {menuOpen && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={t("contextMenu.open")}
          className="border-border bg-popover absolute right-0 bottom-full mb-3 min-w-[11rem] overflow-hidden rounded-2xl border shadow-xl"
        >
          <div className="flex flex-col gap-0.5 p-1.5">
            <button
              type="button"
              role="menuitem"
              className="text-text-body hover:bg-muted focus-visible:ring-ring flex min-h-10 w-full cursor-pointer items-center rounded-xl px-3 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none"
              onClick={handleChangeTheme}
            >
              {t("contextMenu.theme")}
            </button>
            <Link
              role="menuitem"
              href={`/${locale}${ROUTES.settings}`}
              className="text-text-body hover:bg-muted focus-visible:ring-ring flex min-h-10 items-center rounded-xl px-3 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none"
              onClick={() => setMenuOpen(false)}
            >
              {t("contextMenu.settings")}
            </Link>
            <button
              type="button"
              role="menuitem"
              className="text-destructive hover:bg-muted focus-visible:ring-ring flex min-h-10 w-full cursor-pointer items-center rounded-xl px-3 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none"
              onClick={handleHide}
            >
              {t("contextMenu.hide")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
