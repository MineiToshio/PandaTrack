"use client";

import AnchorLink from "@/components/core/AnchorLink";
import { X } from "lucide-react";
import { cn } from "@/lib/styles";
import { buttonVariants } from "@/components/core/Button/buttonVariants";
import IconButton from "@/components/core/IconButton";
import Logo from "@/components/core/Logo";
import HeaderNav, { HeaderNavItem } from "./HeaderNav";
import LanguageToggle from "./LanguageToggle";
import ThemeToggle from "./ThemeToggle";
import { POSTHOG_EVENTS } from "@/lib/constants";

type BurgerMenuProps = {
  isOpen: boolean;
  onClose: () => void;
  items: HeaderNavItem[];
  ctaLabel: string;
};

export default function BurgerMenu({ isOpen, onClose, items, ctaLabel }: BurgerMenuProps) {
  const handleLogoClick = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    onClose();
  };

  return (
    <div className={cn("fixed inset-0 z-50 lg:hidden", isOpen ? "pointer-events-auto" : "pointer-events-none")}>
      <button
        type="button"
        aria-label="Close menu"
        className={cn(
          "bg-background/80 absolute inset-0 backdrop-blur-sm transition-opacity",
          isOpen ? "opacity-100" : "opacity-0",
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          "border-border bg-surface text-foreground absolute top-0 right-0 flex h-full w-80 max-w-[85vw] min-w-0 flex-col border-l transition-transform duration-200",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-auto p-4 sm:p-6">
          <div className="flex min-w-0 shrink-0 items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleLogoClick}
              aria-label="Scroll to top"
              className="min-w-0 shrink-0 cursor-pointer border-none bg-transparent p-0"
            >
              <Logo className="text-text-title" />
            </button>
            <IconButton
              Icon={X}
              variant="outline"
              size="sm"
              aria-label="Close menu"
              onClick={onClose}
              className="shrink-0"
            />
          </div>
          <div className="mt-8 flex-1">
            <HeaderNav
              items={items}
              className="flex-col items-start gap-4 text-base"
              itemClassName="py-2"
              onNavigate={onClose}
            />
            <div className="mt-6 flex items-center gap-3">
              <LanguageToggle className="justify-start gap-2 text-base [&>span]:gap-2" compact onNavigate={onClose} />
              <ThemeToggle />
            </div>
          </div>
          <AnchorLink
            href="#waitlist"
            className={cn(buttonVariants({ variant: "primary", size: "md" }), "w-full")}
            posthogEvent={POSTHOG_EVENTS.LANDING.MOBILE_MENU_NAV_CLICKED}
            posthogProps={{
              destination: "waitlist",
              cta_type: "primary",
            }}
            onClick={onClose}
          >
            {ctaLabel}
          </AnchorLink>
        </div>
      </aside>
    </div>
  );
}
