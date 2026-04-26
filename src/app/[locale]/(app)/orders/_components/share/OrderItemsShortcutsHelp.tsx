"use client";

import { Keyboard } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import Tooltip from "@/components/core/Tooltip";

/**
 * Returns whether the current device reports a macOS-family platform (Mac, iPad,
 * iPhone, iPod). Only used to label the `Alt` key as "Option" on Apple keyboards.
 * Uses a lazy `useState` initializer so the check runs once per mount without a
 * `setState`-in-effect round trip.
 */
function useIsMac(): boolean {
  const [isMac] = useState<boolean>(() => {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent || "";
    // `navigator.platform` is deprecated but still widely implemented and reliable
    // for this coarse Mac-vs-not check; we concatenate with userAgent to catch
    // both Intel Macs (`MacIntel`) and Apple Silicon where UA may lead.
    const platform = navigator.platform || "";
    return /Mac|iPod|iPhone|iPad/i.test(`${ua} ${platform}`);
  });
  return isMac;
}

function ShortcutKey({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="border-border/70 bg-muted/60 text-text-body inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[10px] font-medium">
      {children}
    </kbd>
  );
}

type ShortcutRowProps = {
  keys: React.ReactNode;
  description: string;
};

function ShortcutRow({ keys, description }: ShortcutRowProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-none items-center gap-1">{keys}</div>
      <span className="text-text-body flex-1 text-[11px] leading-snug">{description}</span>
    </div>
  );
}

function Plus() {
  return <span className="text-text-muted text-[10px]">+</span>;
}

function Slash() {
  return <span className="text-text-muted text-[10px]">/</span>;
}

/**
 * Inline discoverability affordance for the item grid's keyboard shortcuts.
 *
 * Placement: rendered next to the "Artículos" section heading in
 * {@link ../../_components/share/OrderForm.tsx}. This mirrors the existing
 * tooltip pattern used by the currency and exchange-rate labels, anchoring
 * help at the point where the user first scans the section.
 *
 * Mobile: the entire affordance is hidden (`hidden md:inline-flex`) because
 * grid shortcuts rely on a physical keyboard that touch-only devices don't have.
 *
 * Modifier strategy: core shortcuts use `Ctrl + Shift` (literal Ctrl on both Mac
 * and Windows — same key label on every OS, free of OS-level conflicts). Reorder
 * uses `Alt + Shift + ↑/↓` (VSCode "move line" convention) as an explicitly
 * distinct combo; the `Alt` key is labeled "Option" on macOS via {@link useIsMac}
 * to match the physical keycap legend.
 */
export default function OrderItemsShortcutsHelp() {
  const t = useTranslations("orders.form");
  const isMac = useIsMac();
  const altLabel = isMac ? "Option" : "Alt";

  return (
    <span className="hidden md:inline-flex">
      <Tooltip
        side="top"
        alignSelfInFlexRow="center"
        triggerClassName="text-text-muted hover:text-foreground -m-0.5 rounded p-0.5"
        content={
          <div className="space-y-2 py-0.5">
            <p className="text-text-title text-[11px] font-semibold tracking-wide uppercase">
              {t("itemsShortcutsTitle")}
            </p>
            <div className="space-y-1.5">
              <ShortcutRow
                keys={
                  <>
                    <ShortcutKey>Shift</ShortcutKey>
                    <Plus />
                    <ShortcutKey>Ctrl</ShortcutKey>
                    <Plus />
                    <ShortcutKey>↑</ShortcutKey>
                    <Slash />
                    <ShortcutKey>↓</ShortcutKey>
                  </>
                }
                description={t("itemsShortcutsNavigate")}
              />
              <ShortcutRow
                keys={
                  <>
                    <ShortcutKey>Shift</ShortcutKey>
                    <Plus />
                    <ShortcutKey>Ctrl</ShortcutKey>
                    <Plus />
                    <ShortcutKey>←</ShortcutKey>
                    <Slash />
                    <ShortcutKey>→</ShortcutKey>
                  </>
                }
                description={t("itemsShortcutsMoveHoriz")}
              />
              <ShortcutRow
                keys={
                  <>
                    <ShortcutKey>Shift</ShortcutKey>
                    <Plus />
                    <ShortcutKey>Ctrl</ShortcutKey>
                    <Plus />
                    <ShortcutKey>Enter</ShortcutKey>
                  </>
                }
                description={t("itemsShortcutsAddBelow")}
              />
              <ShortcutRow
                keys={
                  <>
                    <ShortcutKey>Shift</ShortcutKey>
                    <Plus />
                    <ShortcutKey>Ctrl</ShortcutKey>
                    <Plus />
                    <ShortcutKey>Backspace</ShortcutKey>
                  </>
                }
                description={t("itemsShortcutsDelete")}
              />
              <ShortcutRow
                keys={
                  <>
                    <ShortcutKey>Shift</ShortcutKey>
                    <Plus />
                    <ShortcutKey>{altLabel}</ShortcutKey>
                    <Plus />
                    <ShortcutKey>↑</ShortcutKey>
                    <Slash />
                    <ShortcutKey>↓</ShortcutKey>
                  </>
                }
                description={t("itemsShortcutsReorder")}
              />
            </div>
            <p className="text-text-muted pt-1 text-[10px] leading-snug">{t("itemsShortcutsTabHint")}</p>
          </div>
        }
      >
        <span className="inline-flex items-center">
          <span className="sr-only">{t("itemsShortcutsHelpLabel")}</span>
          <Keyboard size={16} aria-hidden />
        </span>
      </Tooltip>
    </span>
  );
}
