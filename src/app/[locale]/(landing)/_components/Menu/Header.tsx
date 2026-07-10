"use client";

import { Menu } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import Button from "@/components/core/Button/Button";
import BrandMark from "@/app/[locale]/_components/public/BrandMark";
import PublicLanguageToggle from "@/app/[locale]/_components/public/PublicLanguageToggle";
import PublicThemeToggle from "@/app/[locale]/_components/public/PublicThemeToggle";
import { POSTHOG_EVENTS, ROUTES } from "@/lib/constants";
import BurgerMenu from "./BurgerMenu";
import HeaderNav, { HeaderNavItem } from "./HeaderNav";

const NAV_ITEMS: HeaderNavItem[] = [
  { key: "forYou", href: "#user-fit" },
  { key: "features", href: "#features" },
  { key: "faq", href: "#faqs" },
];

export default function Header() {
  const locale = useLocale();
  const t = useTranslations("landing.header");
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const homeHref = `/${locale}${ROUTES.home}`;
  const signInHref = `/${locale}${ROUTES.signIn}`;
  const signUpHref = `/${locale}${ROUTES.signUp}`;

  const handleOpenMenu = () => setIsMenuOpen(true);
  const handleCloseMenu = () => setIsMenuOpen(false);

  return (
    <>
      <header className="mk-header sticky top-0 z-30">
        <div className="mk-container mk-header-inner">
          <BrandMark href={homeHref} ariaLabel={t("brandHome")} />
          <HeaderNav items={NAV_ITEMS} />
          <div className="mk-header-spacer" />
          <div className="mk-header-actions">
            <div className="mk-utils">
              <PublicLanguageToggle />
              <PublicThemeToggle />
            </div>
            <Button
              as="a"
              href={signInHref}
              variant="secondary"
              size="sm"
              className="whitespace-nowrap"
              posthogEvent={POSTHOG_EVENTS.LANDING.HEADER_CTA_CLICKED}
              posthogProps={{ location: "header", destination: "sign-in" }}
            >
              {t("signIn")}
            </Button>
            <Button
              as="a"
              href={signUpHref}
              variant="primary"
              size="sm"
              className="whitespace-nowrap"
              posthogEvent={POSTHOG_EVENTS.LANDING.HEADER_CTA_CLICKED}
              posthogProps={{ location: "header", destination: "sign-up" }}
            >
              {t("signUp")}
            </Button>
          </div>
          <button
            ref={menuButtonRef}
            type="button"
            className="mk-burger"
            aria-label={t("openMenu")}
            aria-haspopup="dialog"
            aria-expanded={isMenuOpen}
            data-ph-event={POSTHOG_EVENTS.LANDING.MOBILE_MENU_OPENED}
            onClick={handleOpenMenu}
          >
            <Menu aria-hidden="true" />
          </button>
        </div>
      </header>
      <BurgerMenu isOpen={isMenuOpen} onClose={handleCloseMenu} items={NAV_ITEMS} returnFocusRef={menuButtonRef} />
    </>
  );
}
