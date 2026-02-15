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
import { POSTHOG_EVENTS } from "@/lib/constants";

const NAV_ITEMS: HeaderNavItem[] = [
  { key: "forYou", href: "#user-fit" },
  { key: "features", href: "#features" },
  { key: "faq", href: "#faqs" },
];

export default function Header() {
  const t = useTranslations("landing.header");
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <>
      <header className="border-border bg-background text-foreground sticky top-0 z-40 w-full border-b">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <Logo />
          <div className="hidden md:flex">
            <HeaderNav items={NAV_ITEMS} />
          </div>
          <div className="flex items-center gap-3">
            <AnchorLink
              href="#waitlist"
              className={cn(buttonVariants({ variant: "primary" }))}
              posthogEvent={POSTHOG_EVENTS.LANDING.HEADER_CTA_CLICKED}
              posthogProps={{ location: "header" }}
            >
              {t("cta")}
            </AnchorLink>
            <IconButton
              Icon={Menu}
              variant="outline"
              className="md:hidden"
              aria-label="Open menu"
              data-ph-event={POSTHOG_EVENTS.LANDING.MOBILE_MENU_OPENED}
              onClick={() => {
                setIsMenuOpen(true);
              }}
            />
          </div>
        </div>
      </header>
      <BurgerMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} items={NAV_ITEMS} ctaLabel={t("cta")} />
    </>
  );
}
