"use client";

import { X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRef } from "react";
import AnchorLink from "@/components/core/AnchorLink";
import Button from "@/components/core/Button/Button";
import BrandMark from "@/app/[locale]/_components/public/BrandMark";
import PublicLanguageToggle from "@/app/[locale]/_components/public/PublicLanguageToggle";
import PublicThemeToggle from "@/app/[locale]/_components/public/PublicThemeToggle";
import { POSTHOG_EVENTS, ROUTES } from "@/lib/constants";
import { useFocusScope } from "@/lib/a11y/useFocusScope";
import { cn } from "@/lib/styles";
import type { HeaderNavItem } from "./HeaderNav";

type BurgerMenuProps = {
  isOpen: boolean;
  onClose: () => void;
  items: HeaderNavItem[];
  returnFocusRef: React.RefObject<HTMLButtonElement | null>;
};

/**
 * Mobile side sheet (`.mk-sheet-*`): backdrop + right panel. Display-toggled
 * (matches the demo, keeps closed links out of the tab order). Focus trap, Esc
 * close and focus return are handled by `useFocusScope` while open.
 */
export default function BurgerMenu({ isOpen, onClose, items, returnFocusRef }: BurgerMenuProps) {
  const locale = useLocale();
  const t = useTranslations("landing.header");
  const tNav = useTranslations("landing.header.nav");
  const panelRef = useRef<HTMLDivElement>(null);

  useFocusScope({ active: isOpen, rootRef: panelRef, onClose, returnFocusRef });

  const signInHref = `/${locale}${ROUTES.signIn}`;
  const signUpHref = `/${locale}${ROUTES.signUp}`;

  return (
    <div className={cn(isOpen ? "block" : "hidden")} aria-hidden={!isOpen}>
      <div className="mk-sheet-backdrop z-[59]" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("menuDialogLabel")}
        className="mk-sheet-panel z-[60]"
      >
        <div className="mk-sheet-head">
          <BrandMark />
          <button type="button" className="mk-sheet-close" aria-label={t("closeMenu")} onClick={onClose}>
            <X aria-hidden="true" />
          </button>
        </div>
        {items.map((item) => (
          <AnchorLink
            key={item.href}
            href={item.href}
            className="mk-sheet-link"
            onClick={onClose}
            posthogEvent={POSTHOG_EVENTS.LANDING.MOBILE_MENU_NAV_CLICKED}
            posthogProps={{ destination: item.key }}
          >
            {tNav(item.key)}
          </AnchorLink>
        ))}
        <div className="my-2.5 h-px [background:var(--border)]" aria-hidden="true" />
        <div className="mk-utils px-3 py-1.5">
          <PublicLanguageToggle />
          <PublicThemeToggle />
        </div>
        <Button as="a" href={signInHref} variant="secondary" fullWidth className="mt-2" onClick={onClose}>
          {t("signIn")}
        </Button>
        <Button
          as="a"
          href={signUpHref}
          variant="primary"
          fullWidth
          className="mt-2"
          onClick={onClose}
          posthogEvent={POSTHOG_EVENTS.LANDING.MOBILE_MENU_NAV_CLICKED}
          posthogProps={{ destination: "sign-up", cta_type: "primary" }}
        >
          {t("signUp")}
        </Button>
      </div>
    </div>
  );
}
