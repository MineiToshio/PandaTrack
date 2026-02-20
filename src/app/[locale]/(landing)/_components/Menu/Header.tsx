"use client";

import { useState } from "react";
import Logo from "@/components/core/Logo";
import HeaderNav, { HeaderNavItem } from "./HeaderNav";
import AnchorLink from "@/components/core/AnchorLink";
import { cn } from "@/lib/styles";
import { buttonVariants } from "@/components/core/Button/buttonVariants";
import { useTranslations } from "next-intl";
import IconButton from "@/components/core/IconButton";
import { Menu } from "lucide-react";
import BurgerMenu from "./BurgerMenu";
import LanguageToggle from "./LanguageToggle";
import ThemeToggle from "./ThemeToggle";
import { POSTHOG_EVENTS } from "@/lib/constants";

const NAV_ITEMS: HeaderNavItem[] = [
  { key: "forYou", href: "#user-fit" },
  { key: "features", href: "#features" },
  { key: "faq", href: "#faqs" },
];

export default function Header() {
  const t = useTranslations("landing.header");
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleOpenMenu = () => {
    setIsMenuOpen(true);
  };

  const handleCloseMenu = () => {
    setIsMenuOpen(false);
  };

  const handleLogoClick = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      <header className="border-border bg-background text-foreground sticky top-0 z-40 w-full border-b">
        <div className="mx-auto flex w-full max-w-6xl min-w-0 items-center justify-between gap-3 px-4 py-4 sm:gap-4 sm:px-6">
          <button
            type="button"
            onClick={handleLogoClick}
            aria-label="Scroll to top"
            className="shrink-0 cursor-pointer border-none bg-transparent p-0"
          >
            <Logo />
          </button>
          <div className="hidden min-w-0 flex-1 justify-center lg:flex lg:gap-6">
            <HeaderNav items={NAV_ITEMS} />
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <LanguageToggle className="hidden lg:flex" />
            <ThemeToggle className="hidden lg:flex" />
            <AnchorLink
              href="#waitlist"
              className={cn(buttonVariants({ variant: "primary", size: "sm" }), "whitespace-nowrap sm:h-10 sm:px-4")}
              posthogEvent={POSTHOG_EVENTS.LANDING.HEADER_CTA_CLICKED}
              posthogProps={{ location: "header" }}
            >
              {t("cta")}
            </AnchorLink>
            <IconButton
              Icon={Menu}
              variant="outline"
              className="lg:hidden"
              aria-label="Open menu"
              data-ph-event={POSTHOG_EVENTS.LANDING.MOBILE_MENU_OPENED}
              onClick={handleOpenMenu}
            />
          </div>
        </div>
      </header>
      <BurgerMenu isOpen={isMenuOpen} onClose={handleCloseMenu} items={NAV_ITEMS} ctaLabel={t("cta")} />
    </>
  );
}
